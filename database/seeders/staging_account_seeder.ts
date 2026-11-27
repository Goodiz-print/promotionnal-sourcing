import { BaseSeeder } from '@adonisjs/lucid/seeders'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import env from '#start/env'
import AgencyProfile from '#models/agency_profile'
import Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'
import Role from '#models/role'
import Supplier from '#models/supplier'
import SupplierProfile from '#models/supplier_profile'
import User from '#models/user'
import { demoPassword } from '#database/seed_password'
import {
  STAGING_SUPPLIER_ACCOUNTS,
  firstNameFromEmail,
  parseAdminEmails,
  stagingAgencyAccounts,
} from '#shared/helpers/staging_accounts'
import type {
  StagingAccountContext,
  StagingAgencyAccount,
  StagingOwnerAccount,
  StagingSupplierAccount,
} from '#shared/types/seed'

/**
 * Comptes des tests utilisateurs du staging (docs/deploiement.md § Données du
 * staging) : admins nominatifs (`SEED_ADMIN_EMAILS`), un compte fournisseur
 * fictif par catalogue importé et des agences fictives, chacun `owner` de sa
 * propre organisation. Mot de passe commun : `SEED_DEMO_PASSWORD`.
 *
 * Hors `MainSeeder` : à lancer **après** `supplier:import`, puisqu'il rattache
 * les fiches importées. Sans `SEED_ADMIN_EMAILS`, ne fait rien (un `db:seed`
 * sans `--files` exécute chaque fichier du dossier). Relançable.
 */
export default class StagingAccountSeeder extends BaseSeeder {
  async run() {
    const adminEmails = parseAdminEmails(env.get('SEED_ADMIN_EMAILS'))
    if (adminEmails.length === 0) {
      logger.info('StagingAccountSeeder ignoré : SEED_ADMIN_EMAILS est vide')
      return
    }

    const password = demoPassword()
    const ownerRole = await Role.findByOrFail('slug', 'owner')
    const admins = await Promise.all(adminEmails.map((email) => this.seedAdmin(email, password)))
    const context: StagingAccountContext = {
      password,
      ownerRoleId: ownerRole.id,
      linkedByUserId: admins[0].id,
    }

    await Promise.all([
      ...STAGING_SUPPLIER_ACCOUNTS.map((account) => this.seedSupplier(account, context)),
      ...stagingAgencyAccounts().map((account) => this.seedAgency(account, context)),
    ])
  }

  /** Admin plateforme nominatif, sans organisation (comme l'admin de démo). */
  private async seedAdmin(email: string, password: string): Promise<User> {
    return User.updateOrCreate(
      { email },
      {
        firstName: firstNameFromEmail(email),
        lastName: 'Staging',
        password,
        emailVerifiedAt: DateTime.now(),
        platformRole: 'admin',
        currentOrganizationId: null,
      }
    )
  }

  /** Fournisseur fictif : organisation, profil, owner, puis sa fiche importée. */
  private async seedSupplier(account: StagingSupplierAccount, context: StagingAccountContext) {
    const organization = await this.seedOrganization(account, 'supplier')
    await SupplierProfile.updateOrCreate(
      { organizationId: organization.id },
      { minOrderQuantity: 50, deliveryDays: 10, deliveryScope: 'europe', responseTimeDays: 2 }
    )
    await this.seedOwner(account, organization, context)
    await this.linkImportedSupplier(account.supplierSlug, organization.id, context)
  }

  /** Agence fictive : organisation acheteuse, profil d'agence, owner. */
  private async seedAgency(account: StagingAgencyAccount, context: StagingAccountContext) {
    const organization = await this.seedOrganization(account, 'buyer')
    await AgencyProfile.updateOrCreate(
      { organizationId: organization.id },
      {
        activity: 'object_communication_agency',
        teamSize: 'from_2_to_10',
        purchaseVolume: 'from_100k_to_500k',
        clientSectors: ['smes'],
      }
    )
    await this.seedOwner(account, organization, context)
  }

  private async seedOrganization(
    account: StagingOwnerAccount,
    organizationType: 'buyer' | 'supplier'
  ): Promise<Organization> {
    return Organization.updateOrCreate(
      { slug: account.orgSlug },
      { name: account.orgName, slug: account.orgSlug, country: 'FR', organizationType }
    )
  }

  /** Utilisateur `owner` de l'organisation, qui en fait son organisation courante. */
  private async seedOwner(
    account: StagingOwnerAccount,
    organization: Organization,
    context: StagingAccountContext
  ) {
    const user = await User.updateOrCreate(
      { email: account.email },
      {
        firstName: account.firstName,
        lastName: 'Test',
        password: context.password,
        emailVerifiedAt: DateTime.now(),
        currentOrganizationId: organization.id,
      }
    )
    await OrganizationUser.updateOrCreate(
      { userId: user.id, organizationId: organization.id },
      { roleId: context.ownerRoleId }
    )
  }

  /**
   * Rattache la fiche importée à l'organisation du fournisseur fictif, pour la
   * publier (#240). Volontairement **sans** `AdminSupplierLinkService.link` :
   * celui-ci met tout le catalogue en traduction IA (8 langues, coût élevé) et
   * écrit au journal d'audit, inutiles pour des données de test. La réindexation
   * suit par `node ace search:reindex` (scripts/deploy/clever_seed.sh). Une
   * fiche absente (catalogue non importé) ou déjà rattachée n'est pas touchée.
   */
  private async linkImportedSupplier(
    supplierSlug: string,
    organizationId: number,
    context: StagingAccountContext
  ) {
    const supplier = await Supplier.findBy('slug', supplierSlug)
    if (!supplier || supplier.organizationId !== null) return
    await supplier
      .merge({ organizationId, linkedAt: DateTime.now(), linkedByUserId: context.linkedByUserId })
      .save()
  }
}
