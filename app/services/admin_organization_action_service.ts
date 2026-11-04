import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import emitter from '@adonisjs/core/services/emitter'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AdminAuditService from '#services/admin_audit_service'
import OrganizationService from '#services/organization_service'
import OrganizationMembersService from '#services/organization_members_service'
import OrganizationInvitationsService from '#services/organization_invitations_service'
import OrganizationCatalogueChanged from '#events/organization_catalogue_changed'
import Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'
import OrganizationInvitation from '#models/organization_invitation'
import Product from '#models/product'
import SupplierProfile from '#models/supplier_profile'
import { AdminOrganizationNotFoundException } from '#exceptions/admin_errors'
import {
  OrganizationAlreadyArchivedException,
  OrganizationNotArchivedException,
  OrganizationHasSupplierDataException,
  AdminOrganizationMemberNotFoundException,
  AdminOrganizationInvitationNotFoundException,
} from '#exceptions/admin_organization_errors'
import type { AdminActionContext } from '#shared/types/admin_audit'
import type { OrganizationKind } from '#shared/types/organization'
import type { AdminOrganizationUpdateData } from '#shared/types/admin_organization'
import type { Locale } from '#shared/types/i18n'

interface ActionOptions {
  context: AdminActionContext
}

interface ArchiveOptions extends ActionOptions {}

interface RestoreOptions extends ActionOptions {}

interface UpdateOptions extends ActionOptions {
  data: AdminOrganizationUpdateData
}

interface ChangeTypeOptions extends ActionOptions {
  organizationType: OrganizationKind
}

interface ChangeMemberRoleOptions extends ActionOptions {
  membershipId: number
  roleId: number
}

interface RemoveMemberOptions extends ActionOptions {
  membershipId: number
}

interface RevokeInvitationOptions extends ActionOptions {
  invitationId: number
}

interface ResendInvitationOptions extends ActionOptions {
  invitationId: number
  locale: Locale
}

/**
 * Actions d'administration sur les organisations (#161) : archivage, restauration,
 * modification des informations, changement de type, gestion des membres et
 * invitations. Chaque action est auditee **dans la meme transaction**.
 */
@inject()
export default class AdminOrganizationActionService {
  constructor(
    private orgService: OrganizationService,
    private members: OrganizationMembersService,
    private invitations: OrganizationInvitationsService,
    private audit: AdminAuditService
  ) {}

  /**
   * Archive une organisation. Toutes les invitations en attente sont revoquees.
   * Idempotence : archiver une organisation deja archivee renvoie 409.
   */
  async archive(organizationId: number, options: ArchiveOptions): Promise<Organization> {
    const org = await db.transaction(async (trx) => {
      const organization = await this.lockOrFail(organizationId, trx)

      if (organization.archivedAt) throw new OrganizationAlreadyArchivedException()

      // Reutilise le service existant pour l'archivage dans la transaction
      await this.orgService.archiveWithin(organization, trx)

      await this.audit.record(
        {
          action: 'organization.archived',
          targetType: 'organization',
          targetId: organization.id,
          changes: { after: { archived: true } },
        },
        { ...options.context, client: trx }
      )

      return organization
    })

    // Notification apres le commit
    await this.orgService.notifyArchived(org)

    return org
  }

  /**
   * Restaure une organisation archivee.
   * Idempotence : restaurer une organisation active renvoie 409.
   */
  async restore(organizationId: number, options: RestoreOptions): Promise<Organization> {
    const org = await db.transaction(async (trx) => {
      const organization = await this.lockOrFail(organizationId, trx)

      if (!organization.archivedAt) throw new OrganizationNotArchivedException()

      organization.useTransaction(trx)
      organization.archivedAt = null
      await organization.save()

      await this.audit.record(
        {
          action: 'organization.restored',
          targetType: 'organization',
          targetId: organization.id,
          changes: { after: { archived: false } },
        },
        { ...options.context, client: trx }
      )

      return organization
    })

    // Le catalogue revient dans la recherche publique
    await emitter.emit(OrganizationCatalogueChanged, new OrganizationCatalogueChanged(org.id))

    return org
  }

  /**
   * Modifie les informations d'une organisation (champs texte, hors slug et logo).
   * Audit uniquement si quelque chose change.
   */
  async update(
    organizationId: number,
    options: UpdateOptions
  ): Promise<{ organization: Organization; changed: boolean }> {
    return db.transaction(async (trx) => {
      const organization = await this.lockOrFail(organizationId, trx)

      type AuditValue = string | number | boolean | null
      const before: Record<string, AuditValue> = {}
      const after: Record<string, AuditValue> = {}

      // Detecte les champs modifies
      for (const [key, value] of Object.entries(options.data)) {
        const currentValue = organization[key as keyof Organization]
        if (currentValue !== value) {
          before[key] = (currentValue ?? null) as AuditValue
          after[key] = (value ?? null) as AuditValue
        }
      }

      // Rien ne change : pas d'ecriture ni d'audit
      if (Object.keys(after).length === 0) {
        return { organization, changed: false }
      }

      organization.useTransaction(trx)
      organization.merge(options.data)
      await organization.save()

      await this.audit.record(
        {
          action: 'organization.updated',
          targetType: 'organization',
          targetId: organization.id,
          changes: { before, after },
        },
        { ...options.context, client: trx }
      )

      return { organization, changed: true }
    })
  }

  /**
   * Change le type d'une organisation (buyer|supplier|both).
   * Refuse (409) si l'on passe a un type sans capacite fournisseur alors que
   * l'organisation a des produits ou un profil fournisseur actif.
   */
  async changeType(
    organizationId: number,
    options: ChangeTypeOptions
  ): Promise<{ organization: Organization; changed: boolean }> {
    const org = await db.transaction(async (trx) => {
      const organization = await this.lockOrFail(organizationId, trx)

      // Pas de changement
      if (organization.organizationType === options.organizationType) {
        return { organization, changed: false }
      }

      const previousType = organization.organizationType
      const newType = options.organizationType

      // Si on retire la capacite fournisseur, verifier qu'il n'y a pas de donnees fournisseur
      if (this.hasSupplierCapability(previousType) && !this.hasSupplierCapability(newType)) {
        const [hasProducts, hasProfile] = await Promise.all([
          this.hasSupplierProducts(organization.id, trx),
          this.hasActiveSupplierProfile(organization.id, trx),
        ])
        if (hasProducts || hasProfile) {
          throw new OrganizationHasSupplierDataException(hasProducts, hasProfile)
        }
      }

      organization.useTransaction(trx)
      organization.organizationType = newType
      await organization.save()

      await this.audit.record(
        {
          action: 'organization.type_changed',
          targetType: 'organization',
          targetId: organization.id,
          changes: {
            before: { organizationType: previousType },
            after: { organizationType: newType },
          },
        },
        { ...options.context, client: trx }
      )

      return { organization, changed: true }
    })

    // Si le type a change, mettre a jour le catalogue
    if (org.changed) {
      await emitter.emit(
        OrganizationCatalogueChanged,
        new OrganizationCatalogueChanged(org.organization.id)
      )
    }

    return org
  }

  /**
   * Change le role d'un membre de l'organisation.
   * Refuse si c'est le dernier owner et que le nouveau role n'est pas owner.
   */
  async changeMemberRole(
    organizationId: number,
    options: ChangeMemberRoleOptions
  ): Promise<OrganizationUser> {
    return db.transaction(async (trx) => {
      await this.lockOrFail(organizationId, trx)

      const membership = await OrganizationUser.query({ client: trx })
        .where('id', options.membershipId)
        .where('organizationId', organizationId)
        .preload('role')
        .forUpdate()
        .first()

      if (!membership) throw new AdminOrganizationMemberNotFoundException()

      const previousRoleSlug = membership.role.slug

      // Pas de changement
      if (membership.roleId === options.roleId) return membership

      // Réutilise la règle métier (dernier owner → LastOwnerException).
      await this.members.changeRole(membership, options.roleId)
      const newRoleSlug = membership.role.slug

      await this.audit.record(
        {
          action: 'organization.member_role_changed',
          targetType: 'organization',
          targetId: organizationId,
          changes: {
            before: { memberId: membership.userId, roleSlug: previousRoleSlug },
            after: { memberId: membership.userId, roleSlug: newRoleSlug },
          },
        },
        { ...options.context, client: trx }
      )

      return membership
    })
  }

  /**
   * Retire un membre de l'organisation.
   * Refuse si c'est le dernier owner.
   */
  async removeMember(organizationId: number, options: RemoveMemberOptions): Promise<void> {
    await db.transaction(async (trx) => {
      await this.lockOrFail(organizationId, trx)

      const membership = await OrganizationUser.query({ client: trx })
        .where('id', options.membershipId)
        .where('organizationId', organizationId)
        .preload('user')
        .preload('role')
        .forUpdate()
        .first()

      if (!membership) throw new AdminOrganizationMemberNotFoundException()

      const userId = membership.userId
      const roleSlug = membership.role.slug

      // Réutilise la règle métier (dernier owner, bascule de l'organisation courante).
      await this.members.removeMember(membership)

      await this.audit.record(
        {
          action: 'organization.member_removed',
          targetType: 'organization',
          targetId: organizationId,
          changes: {
            after: { memberId: userId, roleSlug },
          },
        },
        { ...options.context, client: trx }
      )
    })
  }

  /**
   * Revoque une invitation en attente.
   */
  async revokeInvitation(organizationId: number, options: RevokeInvitationOptions): Promise<void> {
    await db.transaction(async (trx) => {
      await this.lockOrFail(organizationId, trx)

      const invitation = await OrganizationInvitation.query({ client: trx })
        .where('id', options.invitationId)
        .where('organizationId', organizationId)
        .forUpdate()
        .first()

      if (!invitation) throw new AdminOrganizationInvitationNotFoundException()

      await this.invitations.revoke(invitation)

      await this.audit.record(
        {
          action: 'organization.invitation_revoked',
          targetType: 'organization',
          targetId: organizationId,
          changes: {
            after: { invitationId: invitation.id, email: invitation.email },
          },
        },
        { ...options.context, client: trx }
      )
    })
  }

  /**
   * Renvoie une invitation en attente : prolonge son expiration et envoie le mail.
   * Refuse si l'invitation n'est plus en attente.
   */
  async resendInvitation(
    organizationId: number,
    options: ResendInvitationOptions
  ): Promise<OrganizationInvitation> {
    const invitation = await db.transaction(async (trx) => {
      const organization = await this.lockOrFail(organizationId, trx)

      const inv = await OrganizationInvitation.query({ client: trx })
        .where('id', options.invitationId)
        .where('organizationId', organizationId)
        .preload('role')
        .preload('invitedBy')
        .forUpdate()
        .first()

      if (!inv) throw new AdminOrganizationInvitationNotFoundException()
      // Prolonge l'expiration (rejette une invitation qui n'est plus en attente).
      await this.invitations.resend(inv)

      await this.audit.record(
        {
          action: 'organization.invitation_resent',
          targetType: 'organization',
          targetId: organizationId,
          changes: {
            after: { invitationId: inv.id, email: inv.email },
          },
        },
        { ...options.context, client: trx }
      )

      return { invitation: inv, organization }
    })

    // Le mail part après le commit.
    const { invitation: resent, organization } = invitation
    const inviter = resent.invitedBy
    await this.invitations.sendMail(
      resent,
      organization,
      inviter?.fullName ?? inviter?.email ?? options.context.actor?.email ?? '',
      options.locale
    )

    return invitation.invitation
  }

  /**
   * Charge l'organisation **verrouillee** (`FOR UPDATE`) dans la transaction :
   * deux actions simultanees sont serialisees et l'etat relu est celui qui sera
   * effectivement modifie.
   */
  private async lockOrFail(id: number, trx: TransactionClientContract): Promise<Organization> {
    const organization = await Organization.query({ client: trx })
      .where('id', id)
      .forUpdate()
      .first()
    if (!organization) throw new AdminOrganizationNotFoundException()
    return organization
  }

  private hasSupplierCapability(type: OrganizationKind): boolean {
    return type === 'supplier' || type === 'both'
  }

  private async hasSupplierProducts(
    organizationId: number,
    trx: TransactionClientContract
  ): Promise<boolean> {
    const result = await Product.query({ client: trx })
      .whereHas('supplier', (supplier) => supplier.where('organizationId', organizationId))
      .limit(1)
      .first()
    return result !== null
  }

  private async hasActiveSupplierProfile(
    organizationId: number,
    trx: TransactionClientContract
  ): Promise<boolean> {
    const profile = await SupplierProfile.query({ client: trx })
      .where('organizationId', organizationId)
      .first()
    return profile !== null
  }
}
