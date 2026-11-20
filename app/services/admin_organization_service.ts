import Organization from '#models/organization'
import Role from '#models/role'
import OrganizationInvitation from '#models/organization_invitation'
import OrganizationUser from '#models/organization_user'
import Product from '#models/product'
import Rfq from '#models/rfq'
import SupplierProfile from '#models/supplier_profile'
import AgencyProfile from '#models/agency_profile'
import BillingProfile from '#models/billing_profile'
import OrganizationSubscription from '#models/organization_subscription'
import { AdminOrganizationNotFoundException } from '#exceptions/admin_errors'
import type { ModelPaginatorContract, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { AdminOrganizationIndexFilters } from '#shared/types/admin_organization'
import { SUPPLIER_ORGANIZATION_KINDS } from '#shared/types/organization'

interface ListOptions extends AdminOrganizationIndexFilters {
  page: number
  perPage: number
}

export interface AdminOrganizationDetails {
  organization: Organization
  members: OrganizationUser[]
  pendingInvitations: OrganizationInvitation[]
  productsCount: number
  rfqsCount: number
  supplierProfile: SupplierProfile | null
  agencyProfile: AgencyProfile | null
  billingProfile: BillingProfile | null
  subscriptions: OrganizationSubscription[]
  lastActivity: Date | null
}

/**
 * Consultation des organisations par l'équipe plateforme : toutes les
 * organisations, archivées comprises (contrairement aux écrans publics).
 */
export default class AdminOrganizationService {
  /**
   * Liste paginée, filtrable par type, statut d'archivage, pays, avec recherche
   * sur nom/slug/SIRET/TVA et le nombre de membres (`$extras.members_count`).
   * Les plus récentes d'abord.
   */
  list(options: ListOptions): Promise<ModelPaginatorContract<Organization>> {
    const { page, perPage, type, status, country, search, missingQuoteAddress } = options

    return Organization.query()
      .withCount('organizationUsers', (query) => query.as('members_count'))
      .preload('supplierProfile', (profile) => profile.select('id', 'organizationId', 'quoteEmail'))
      .if(search, (query) => {
        const pattern = `%${escapeLike(search!)}%`
        query.where((sub) =>
          sub
            .whereILike('name', pattern)
            .orWhereILike('slug', pattern)
            .orWhereILike('siret', pattern)
            .orWhereILike('vatNumber', pattern)
        )
      })
      .if(type, (query) => query.where('organizationType', type!))
      .if(status === 'active', (query) => query.whereNull('archivedAt'))
      .if(status === 'archived', (query) => query.whereNotNull('archivedAt'))
      .if(country, (query) => query.where('country', country!))
      .if(missingQuoteAddress, (query) => withoutQuoteAddress(query))
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .paginate(page, perPage)
  }

  /**
   * Recherche l'organisation par id, sans lever d'exception.
   */
  find(id: number): Promise<Organization | null> {
    return Organization.find(id)
  }

  /**
   * Fiche d'une organisation : membres (utilisateur + rôle), invitations en
   * attente, profils (fournisseur, agence, facturation), volumes de produits et
   * de demandes de devis, dernière activité. Lève si l'id n'existe pas.
   */
  async details(id: number): Promise<AdminOrganizationDetails> {
    const organization = await Organization.query()
      .where('id', id)
      .withCount('organizationUsers', (query) => query.as('members_count'))
      .first()
    if (!organization) throw new AdminOrganizationNotFoundException()

    const [
      members,
      pendingInvitations,
      products,
      rfqs,
      supplierProfile,
      agencyProfile,
      billingProfile,
      subscriptions,
    ] = await Promise.all([
      OrganizationUser.query()
        .where('organizationId', id)
        .preload('user')
        .preload('role')
        .orderBy('joinedAt', 'asc'),
      OrganizationInvitation.query()
        .where('organizationId', id)
        .where('status', 'pending')
        .preload('role')
        .preload('invitedBy')
        .orderBy('createdAt', 'desc'),
      Product.query()
        .whereHas('supplier', (supplier) => supplier.where('organizationId', id))
        .count('* as total')
        .firstOrFail(),
      Rfq.query().where('buyerOrganizationId', id).count('* as total').firstOrFail(),
      SupplierProfile.query().where('organizationId', id).first(),
      AgencyProfile.query().where('organizationId', id).first(),
      BillingProfile.query().where('organizationId', id).first(),
      OrganizationSubscription.query()
        .where('organizationId', id)
        .preload('createdBy')
        .orderBy('startsAt', 'desc')
        .orderBy('id', 'desc'),
    ])

    // Dernière activité = dernière connexion d'un membre
    const lastActivity = await this.computeLastActivity(members)

    return {
      organization,
      members,
      pendingInvitations,
      productsCount: Number(products.$extras.total),
      rfqsCount: Number(rfqs.$extras.total),
      supplierProfile,
      agencyProfile,
      billingProfile,
      subscriptions,
      lastActivity,
    }
  }

  /**
   * Calcule la dernière activité comme la connexion la plus récente des membres.
   */
  private async computeLastActivity(members: OrganizationUser[]): Promise<Date | null> {
    let lastLogin: Date | null = null
    for (const membership of members) {
      const userLastLogin = membership.user.lastLoginAt?.toJSDate() ?? null
      if (userLastLogin && (!lastLogin || userLastLogin > lastLogin)) {
        lastLogin = userLastLogin
      }
    }
    return lastLogin
  }

  /**
   * Liste des pays distincts parmi les organisations (pour le filtre).
   */
  async distinctCountries(): Promise<string[]> {
    const result = await Organization.query()
      .select('country')
      .distinct('country')
      .orderBy('country', 'asc')

    return result.map((org) => org.country)
  }

  /** Rôles proposables pour un membre (même liste que l'espace propriétaire). */
  roles(): Promise<Role[]> {
    return Role.all()
  }
}

/**
 * Neutralise les jokers `%` et `_` (et l'échappement) d'une saisie utilisateur
 * avant de l'insérer dans un motif `ILIKE`.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/**
 * Organisations fournisseurs dont les demandes de devis partent faute de mieux
 * aux membres responsables (#217) : ni adresse de réception dans le profil, ni
 * adresse de contact. Même règle que `quoteAddressSource`, une adresse vide
 * comptant comme absente.
 */
function withoutQuoteAddress(query: ModelQueryBuilderContract<typeof Organization>) {
  query
    .whereIn('organizationType', [...SUPPLIER_ORGANIZATION_KINDS])
    .where((email) => email.whereNull('email').orWhereRaw("trim(email) = ''"))
    .whereDoesntHave('supplierProfile', (profile) =>
      profile.whereNotNull('quoteEmail').whereRaw("trim(quote_email) <> ''")
    )
}
