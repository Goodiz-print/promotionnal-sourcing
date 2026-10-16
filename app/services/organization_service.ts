import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import stringHelpers from '@adonisjs/core/helpers/string'
import Organization from '#models/organization'
import OrganizationInvitation from '#models/organization_invitation'
import OrganizationUser from '#models/organization_user'
import Role from '#models/role'
import type User from '#models/user'
import StorageService from '#services/storage/storage_service'
import OrganizationContextService from '#services/organization_context_service'
import OrganizationMembersService from '#services/organization_members_service'
import {
  LastOwnerException,
  NotAMemberException,
  OrganizationArchivedException,
} from '#exceptions/organization_errors'
import type { OnboardingData, UpdateOrganizationSettingsData } from '#shared/types/organization'
import type { MultipartFile } from '@adonisjs/core/bodyparser'

/**
 * Cycle de vie et paramètres généraux de l'organisation : création,
 * départ volontaire, archivage, logo. La bascule d'organisation courante est
 * déléguée à `OrganizationContextService`, l'invariant « dernier owner » à
 * `OrganizationMembersService`. Upload/suppression du logo délégués à
 * StorageService (injecté pour la testabilité, cf. SupplierProductService).
 */
@inject()
export default class OrganizationService {
  constructor(
    private storage: StorageService,
    private context: OrganizationContextService,
    private members: OrganizationMembersService
  ) {}

  /**
   * Crée une organisation et y rattache l'utilisateur en `owner`, qui bascule
   * dessus. Sert aussi bien à l'onboarding (première organisation) qu'à la
   * création d'une organisation supplémentaire — d'où la transaction : les
   * trois écritures (organisation, adhésion, bascule) forment un tout.
   */
  create(user: User, data: OnboardingData): Promise<Organization> {
    return db.transaction(async (trx) => {
      const slug = await this.uniqueSlug(data.name)
      const ownerRole = await Role.findByOrFail('slug', 'owner', { client: trx })

      const organization = await Organization.create(
        { name: data.name, slug, country: 'FR', organizationType: data.organizationType },
        { client: trx }
      )

      await OrganizationUser.create(
        {
          userId: user.id,
          organizationId: organization.id,
          roleId: ownerRole.id,
          joinedAt: DateTime.now(),
        },
        { client: trx }
      )

      user.useTransaction(trx)
      await user.merge({ currentOrganizationId: organization.id }).save()

      return organization
    })
  }

  /**
   * Départ volontaire d'un membre. Même invariant que le retrait par un admin :
   * le dernier owner ne peut pas partir (il doit d'abord promouvoir quelqu'un
   * ou archiver l'organisation). L'utilisateur bascule ensuite sur une autre de
   * ses organisations, ou repart sur l'onboarding s'il n'en a plus.
   */
  async leave(user: User, organization: Organization): Promise<void> {
    const membership = await OrganizationUser.query()
      .where('organizationId', organization.id)
      .where('userId', user.id)
      .first()

    if (!membership) throw new NotAMemberException()
    if (await this.members.isLastOwner(membership)) throw new LastOwnerException()

    await membership.delete()
    await this.context.reassignCurrentOrganization(user, organization.id)
  }

  /**
   * `true` si l'utilisateur peut quitter cette organisation : il en est membre
   * et n'en est pas le dernier owner. Sert à masquer le bouton côté écran — le
   * refus reste appliqué par `leave`.
   */
  async canLeave(user: User, organization: Organization): Promise<boolean> {
    const membership = await OrganizationUser.query()
      .where('organizationId', organization.id)
      .where('userId', user.id)
      .first()

    if (!membership) return false
    return !(await this.members.isLastOwner(membership))
  }

  /**
   * Archive l'organisation : elle sort du catalogue public et de la liste des
   * organisations de ses membres (qui basculent ailleurs ou repartent sur
   * l'onboarding au prochain accès, cf. `OnboardedMiddleware`). Aucune donnée
   * n'est supprimée — la restauration se fait en base (`archived_at` à NULL).
   *
   * Les invitations en attente sont révoquées : un lien en circulation ne doit
   * pas permettre de rejoindre une organisation hors service.
   */
  async archive(organization: Organization): Promise<void> {
    if (organization.archivedAt) throw new OrganizationArchivedException()

    await db.transaction(async (trx) => {
      organization.useTransaction(trx)
      organization.archivedAt = DateTime.now()
      await organization.save()

      await OrganizationInvitation.query({ client: trx })
        .where('organizationId', organization.id)
        .where('status', 'pending')
        .update({ status: 'revoked', updated_at: DateTime.now().toJSDate() })
    })
  }

  /**
   * Met à jour les champs texte de l'organisation (slug et logo exclus : gérés
   * ailleurs).
   */
  async update(
    organization: Organization,
    data: UpdateOrganizationSettingsData
  ): Promise<Organization> {
    organization.merge(data)
    await organization.save()
    return organization
  }

  /**
   * Stocke le nouveau logo (dédoublonné par checksum) puis, dans **une seule
   * transaction**, met la référence à jour et écrit la ligne `pending_delete`
   * de l'ancien logo s'il n'est plus utilisé. La purge de l'ancien objet est
   * lancée après le commit. Si la transaction échoue, le nouvel objet est
   * libéré : aucun fichier orphelin.
   */
  async updateLogo(organization: Organization, file: MultipartFile): Promise<Organization> {
    const stored = await this.storage.store(file)
    const previousId = organization.logoStorageObjectId

    let tombstoneId: number | null
    try {
      tombstoneId = await db.transaction(async (trx) => {
        const row = await Organization.findOrFail(organization.id, { client: trx })
        await row
          .merge({ logoUrl: this.storage.urlFor(stored), logoStorageObjectId: stored.id })
          .save()
        // Même contenu qu'avant : l'objet reste référencé, rien à remplacer.
        return previousId === stored.id ? null : this.storage.release(trx, previousId)
      })
    } catch (error) {
      await this.storage.discard([stored.id])
      throw error
    }

    await this.storage.dispatchDeletions([tombstoneId])
    await organization.refresh()
    return organization
  }

  /**
   * Retire le logo courant (sans remplacement) : remet `logoUrl` /
   * `logoStorageObjectId` à `null` et planifie la purge de l'objet (même
   * transaction), s'il n'est plus utilisé ailleurs.
   */
  async removeLogo(organization: Organization): Promise<Organization> {
    const previousId = organization.logoStorageObjectId

    const tombstoneId = await db.transaction(async (trx) => {
      const row = await Organization.findOrFail(organization.id, { client: trx })
      await row.merge({ logoUrl: null, logoStorageObjectId: null }).save()
      return this.storage.release(trx, previousId)
    })

    await this.storage.dispatchDeletions([tombstoneId])
    await organization.refresh()
    return organization
  }

  /**
   * Slug dérivé du nom, rendu unique par suffixe numérique en cas de collision.
   */
  private async uniqueSlug(name: string): Promise<string> {
    const base = stringHelpers.slug(name, { lower: true }) || 'organisation'
    let slug = base
    let suffix = 2

    while (await Organization.findBy('slug', slug)) {
      slug = `${base}-${suffix}`
      suffix += 1
    }

    return slug
  }
}
