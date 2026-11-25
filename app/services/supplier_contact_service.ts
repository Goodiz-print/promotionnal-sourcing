import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'
import SupplierContact from '#models/supplier_contact'
import SupplierProfile from '#models/supplier_profile'
import type User from '#models/user'
import SubscriptionService from '#services/subscription_service'
import { SupplierContactNotFoundException } from '#exceptions/supplier_contact_errors'
import type {
  SupplierContactData,
  SupplierContactMove,
  SupplierContactViewer,
  SupplierTeamMemberOptionType,
} from '#shared/types/supplier'
import type { OrganizationKind } from '#shared/types/organization'

/** Types d'organisation qui achètent : les seuls à recevoir des contacts commerciaux. */
const AGENCY_KINDS: readonly OrganizationKind[] = ['buyer', 'both']

/**
 * Équipe commerciale des fournisseurs (#241) : gestion par le fournisseur et
 * **seule** règle qui décide quels contacts une agence reçoit (`visibleFor`).
 */
@inject()
export default class SupplierContactService {
  constructor(private subscriptions: SubscriptionService) {}

  /** Contacts du fournisseur, dans l'ordre d'affichage. */
  listForOrganization(organizationId: number): Promise<SupplierContact[]> {
    return SupplierContact.query()
      .where('organizationId', organizationId)
      .orderBy('position', 'asc')
      .orderBy('id', 'asc')
  }

  /** Contact du fournisseur, 404 s'il n'existe pas ou appartient à un autre. */
  async find(organizationId: number, id: number): Promise<SupplierContact> {
    const contact = await SupplierContact.query()
      .where('organizationId', organizationId)
      .where('id', id)
      .first()
    if (!contact) throw new SupplierContactNotFoundException()
    return contact
  }

  /**
   * Ajoute un contact en fin de liste. Hors transaction : deux créations
   * simultanées peuvent recevoir la même position, sans conséquence — l'ordre
   * départage par `id` et `move` renumérote toute l'équipe.
   */
  async create(organizationId: number, data: SupplierContactData): Promise<SupplierContact> {
    const last = await SupplierContact.query()
      .where('organizationId', organizationId)
      .max('position as max')
      .first()
    const max = last?.$extras.max
    const position = max === null || max === undefined ? 0 : Number(max) + 1

    return SupplierContact.create({ ...this.normalize(data), organizationId, position })
  }

  async update(
    organizationId: number,
    id: number,
    data: SupplierContactData
  ): Promise<SupplierContact> {
    const contact = await this.find(organizationId, id)
    contact.merge(this.normalize(data))
    return contact.save()
  }

  async destroy(organizationId: number, id: number): Promise<void> {
    const contact = await this.find(organizationId, id)
    await contact.delete()
  }

  /**
   * Monte ou descend un contact d'un cran. Les positions sont renumérotées
   * (0, 1, 2…) dans la même transaction : l'ordre reste sans trou ni doublon.
   */
  async move(organizationId: number, id: number, direction: SupplierContactMove): Promise<void> {
    await db.transaction(async (trx) => {
      const contacts = await SupplierContact.query({ client: trx })
        .where('organizationId', organizationId)
        .orderBy('position', 'asc')
        .orderBy('id', 'asc')
        .forUpdate()

      const index = contacts.findIndex((contact) => contact.id === id)
      if (index === -1) throw new SupplierContactNotFoundException()

      const target = direction === 'up' ? index - 1 : index + 1
      if (target >= 0 && target < contacts.length) {
        ;[contacts[index], contacts[target]] = [contacts[target], contacts[index]]
      }

      const moved = contacts
        .map((contact, position) => ({ contact, position }))
        .filter(({ contact, position }) => contact.position !== position)
      await Promise.all(
        moved.map(({ contact, position }) => contact.merge({ position }).useTransaction(trx).save())
      )
    })
  }

  /** Membres du compte fournisseur qu'un contact peut relier. */
  async memberOptions(organizationId: number): Promise<SupplierTeamMemberOptionType[]> {
    const members = await OrganizationUser.query()
      .where('organizationId', organizationId)
      .preload('user')
      .orderBy('joinedAt', 'asc')

    return members.map(({ user }) => ({
      id: user.id,
      name: user.fullName ?? user.email,
      email: user.email,
    }))
  }

  /** Option « montrer toute l'équipe à toutes les agences » (désactivée par défaut). */
  async showsAllContacts(organizationId: number): Promise<boolean> {
    const profile = await SupplierProfile.findBy('organizationId', organizationId)
    return profile?.showAllContacts ?? false
  }

  async setShowAllContacts(organizationId: number, showAllContacts: boolean): Promise<void> {
    await SupplierProfile.updateOrCreate({ organizationId }, { showAllContacts })
  }

  /**
   * Visiteur à partir de l'utilisateur connecté : son organisation courante,
   * si elle peut recevoir des contacts (`viewerForOrganization`). `null` pour
   * un visiteur anonyme ou sans organisation.
   */
  async viewerFor(user: User | null | undefined): Promise<SupplierContactViewer | null> {
    if (!user?.currentOrganizationId) return null
    const organization = await Organization.find(user.currentOrganizationId)
    return organization ? this.viewerForOrganization(organization) : null
  }

  /**
   * L'organisation reçoit-elle des contacts commerciaux ? Seulement une
   * **agence** (`buyer` ou `both`) **validée** : pas un fournisseur pur (un
   * concurrent ne reçoit pas l'équipe des autres), pas une organisation
   * archivée (agence refusée comprise), pas une agence en cours de validation
   * (`review_reasons` non vide : en attente ou complément demandé).
   */
  viewerForOrganization(organization: Organization): SupplierContactViewer | null {
    if (organization.archivedAt) return null
    if (!AGENCY_KINDS.includes(organization.organizationType)) return null
    if ((organization.reviewReasons ?? []).length > 0) return null
    return { organizationId: organization.id, country: organization.country || null }
  }

  /**
   * Contacts qu'un visiteur reçoit pour un fournisseur — règle unique, évaluée
   * à la lecture (un fournisseur qui s'abonne ou expire change aussitôt ce
   * que voient les agences) :
   *
   * 1. visiteur non connecté, ou fournisseur non abonné : aucun contact ;
   * 2. option « montrer toute l'équipe » : tous les contacts ;
   * 3. sinon les contacts qui couvrent le pays du visiteur (ou tous les pays) ;
   * 4. si aucun ne correspond : tous les contacts (repli).
   *
   * Les contacts écartés ne quittent jamais le serveur.
   */
  async visibleFor(
    supplierOrganizationId: number,
    viewer: SupplierContactViewer | null
  ): Promise<SupplierContact[]> {
    const visible = await this.visibleForMany([supplierOrganizationId], viewer)
    return visible.get(supplierOrganizationId) ?? []
  }

  /**
   * `visibleFor` pour plusieurs fournisseurs (destinataires d'une demande), en
   * trois requêtes quel que soit leur nombre. Les fournisseurs sans contact
   * visible sont absents du résultat.
   */
  async visibleForMany(
    supplierOrganizationIds: number[],
    viewer: SupplierContactViewer | null
  ): Promise<Map<number, SupplierContact[]>> {
    const result = new Map<number, SupplierContact[]>()
    if (!viewer || supplierOrganizationIds.length === 0) return result

    const subscribed = [...(await this.subscriptions.subscribedAmong(supplierOrganizationIds))]
    if (subscribed.length === 0) return result

    const [contacts, profiles] = await Promise.all([
      SupplierContact.query()
        .whereIn('organizationId', subscribed)
        .orderBy('position', 'asc')
        .orderBy('id', 'asc'),
      SupplierProfile.query()
        .whereIn('organizationId', subscribed)
        .where('showAllContacts', true)
        .select('organizationId'),
    ])
    const showAll = new Set(profiles.map((profile) => profile.organizationId))
    const country = viewer.country?.toUpperCase() ?? null

    return new Map(
      [...Map.groupBy(contacts, (contact) => contact.organizationId)].map(
        ([organizationId, team]) => [
          organizationId,
          showAll.has(organizationId) ? team : this.forCountry(team, country),
        ]
      )
    )
  }

  /** Contacts qui couvrent le pays (ou tous les pays) ; à défaut, toute l'équipe. */
  private forCountry(team: SupplierContact[], country: string | null): SupplierContact[] {
    const matching = team.filter(
      (contact) =>
        contact.countries.length === 0 || (country !== null && contact.countries.includes(country))
    )
    return matching.length > 0 ? matching : team
  }

  /** Champs saisis, nettoyés : pays en majuscules, sans doublon. */
  private normalize(data: SupplierContactData) {
    return {
      name: data.name,
      jobTitle: data.jobTitle ?? null,
      email: data.email,
      phone: data.phone ?? null,
      languages: [...new Set(data.languages ?? [])],
      countries: [...new Set((data.countries ?? []).map((code) => code.toUpperCase()))],
      userId: data.userId ?? null,
    }
  }
}
