import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { answerConfirm, mountConfirmHost } from './support/confirm_dialog'
import type {
  AdminOrganizationDetail,
  AdminOrganizationIndexFilters,
  AdminOrganizationListItem,
} from '#shared/types/admin_organization'
import type { RoleType } from '#shared/types/role'

const translations: Record<string, string> = {
  'admin.organizations.title': 'Organisations',
  'admin.organizations.subtitle': 'Toutes les organisations.',
  'admin.organizations.empty': 'Aucune organisation.',
  'admin.organizations.emptyDescription': 'Élargissez la liste.',
  'admin.organizations.back': 'Retour',
  'admin.organizations.filters.search': 'Rechercher',
  'admin.organizations.filters.type': 'Type',
  'admin.organizations.filters.allTypes': 'Tous les types',
  'admin.organizations.filters.status': 'Statut',
  'admin.organizations.filters.country': 'Pays',
  'admin.organizations.filters.allCountries': 'Tous les pays',
  'admin.organizations.filters.missingQuoteAddress': 'Sans adresse de réception',
  'admin.organizations.quoteAddress.missing': 'Sans adresse de réception',
  'admin.organizations.types.buyer': 'Acheteur',
  'admin.organizations.types.supplier': 'Fournisseur',
  'admin.organizations.types.both': 'Les deux',
  'admin.organizations.status.active': 'Active',
  'admin.organizations.status.archived': 'Archivée',
  'admin.organizations.status.all': 'Toutes',
  'admin.organizations.columns.name': 'Nom',
  'admin.organizations.columns.type': 'Type',
  'admin.organizations.columns.country': 'Pays',
  'admin.organizations.columns.members': 'Membres',
  'admin.organizations.columns.status': 'Statut',
  'admin.organizations.columns.lastActivity': 'Dernière activité',
  'admin.organizations.roles.owner': 'Propriétaire',
  'admin.organizations.roles.member': 'Membre',
  'admin.organizations.detail.products': 'Produits',
  'admin.organizations.detail.rfqs': 'Demandes de devis',
  'admin.organizations.detail.overview': 'Synthèse',
  'admin.organizations.detail.info': 'Modifier les informations',
  'admin.organizations.detail.typeSection': 'Type d’organisation',
  'admin.organizations.detail.save': 'Enregistrer',
  'admin.organizations.detail.archivedNotice': 'Organisation archivée.',
  'admin.organizations.detail.members': 'Membres ({count})',
  'admin.organizations.detail.membersCaption': 'Membres',
  'admin.organizations.detail.role': 'Rôle',
  'admin.organizations.detail.joinedAt': 'Membre depuis',
  'admin.organizations.detail.notProvided': 'Non renseigné',
  'admin.organizations.detail.member.removeConfirm': 'Retirer {name} ?',
  'admin.organizations.detail.member.remove': 'Retirer',
  'admin.organizations.detail.member.roleLabel': 'Rôle de {name}',
  'admin.organizations.detail.member.actions': 'Actions',
  'admin.organizations.detail.invitation.title': 'Invitations en attente',
  'admin.organizations.detail.invitation.empty': 'Aucune invitation.',
  'admin.organizations.detail.invitation.resend': 'Renvoyer',
  'admin.organizations.detail.invitation.resendConfirm': 'Renvoyer à {email} ?',
  'admin.organizations.detail.invitation.revoke': 'Révoquer',
  'admin.organizations.detail.invitation.revokeConfirm': 'Révoquer {email} ?',
  'admin.organizations.detail.lifecycle.title': 'Archivage',
  'admin.organizations.detail.profile.supplier.title': 'Profil fournisseur',
  'admin.organizations.detail.profile.agency.title': 'Profil agence',
  'admin.organizations.detail.profile.agency.reviewReasons': 'Motifs de revue',
  'admin.organizations.detail.profile.billing.title': 'Facturation',
  'admin.organizations.detail.profile.billing.city': 'Ville',
  'admin.organizations.actions.archive.label': 'Archiver',
  'admin.organizations.actions.archive.confirm': 'Archiver ?',
  'admin.organizations.actions.restore.label': 'Restaurer',
  'admin.organizations.actions.restore.confirm': 'Restaurer ?',
  'admin.organizations.actions.changeType.label': 'Changer le type',
  'admin.agencyReviews.reasons.no_website': 'Pas de site web',
  'admin.agencyReviews.verified': 'Vérifié',
  'admin.agencyReviews.notVerified': 'Non vérifié',
  'admin.users.show.never': 'Jamais',
  'admin.users.noName': 'Sans nom',
  'admin.users.columns.name': 'Nom',
  'admin.users.columns.email': 'Email',
  'admin.trade.filters.apply': 'Filtrer',
  'admin.trade.filters.reset': 'Réinitialiser',
  'admin.pagination.previous': 'Précédent',
  'admin.pagination.next': 'Suivant',
  'organization.fields.name': 'Nom',
  'organization.fields.siret': 'SIRET',
  'organization.fields.city': 'Ville',
  'organization.size.none': 'Non précisé',
}

const get = vi.fn()
const patch = vi.fn()
const post = vi.fn()
const del = vi.fn()
const formPatch = vi.fn()

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    // `transform` est appliqué à l'envoi pour pouvoir asserter le payload réel.
    useForm: (data: Record<string, unknown>) => {
      let transformer: ((d: Record<string, unknown>) => unknown) | null = null
      const form = reactive({
        ...data,
        errors: { siret: 'SIRET invalide' } as Record<string, string>,
        processing: false,
        transform(cb: (d: Record<string, unknown>) => unknown) {
          transformer = cb
          return form
        },
        patch(url: string, options: unknown) {
          formPatch(url, transformer ? transformer({ ...data, ...form }) : form, options)
        },
      })
      return form
    },
    router: {
      get: (...args: unknown[]) => get(...args),
      patch: (...args: unknown[]) => patch(...args),
      post: (...args: unknown[]) => post(...args),
      delete: (...args: unknown[]) => del(...args),
    },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({
  urlFor: (name: string, params?: Record<string, number | string>) => {
    const ids = [params?.id, params?.membershipId, params?.invitationId].filter(Boolean).join('/')
    return `/fr/${name}${ids ? `/${ids}` : ''}`
  },
}))
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})

const { default: Index } = await import('~/pages/admin/organizations/index.vue')
const { default: Show } = await import('~/pages/admin/organizations/show.vue')

const NO_FILTERS: AdminOrganizationIndexFilters = {
  search: null,
  type: null,
  status: 'active',
  country: null,
  missingQuoteAddress: false,
}

function item(
  id: number,
  extra: Partial<AdminOrganizationListItem> = {}
): AdminOrganizationListItem {
  return {
    id,
    name: `Org ${id}`,
    slug: `org-${id}`,
    organizationType: 'supplier',
    country: 'FR',
    membersCount: 2,
    archivedAt: null,
    createdAt: '2026-10-17T10:00:00.000Z',
    lastActivity: null,
    quoteAddressSource: 'organization_email',
    ...extra,
  }
}

function renderIndex(
  data: AdminOrganizationListItem[],
  lastPage = 1,
  filters: AdminOrganizationIndexFilters = NO_FILTERS
) {
  return mount(Index, {
    props: {
      organizationList: {
        data,
        meta: { total: data.length, perPage: 25, currentPage: 1, lastPage },
      },
      filters,
      filterOptions: { organizationTypes: ['buyer', 'supplier', 'both'], countries: ['FR', 'DE'] },
      canManage: true,
    },
  })
}

describe('admin/organizations/index', () => {
  beforeEach(() => get.mockClear())

  it('affiche les lignes, la dernière activité, le badge archivée et le lien vers la fiche', () => {
    const wrapper = renderIndex([
      item(1, { lastActivity: '2026-10-18T10:00:00.000Z' }),
      item(2, { archivedAt: '2026-10-19T10:00:00.000Z' }),
    ])
    const rows = wrapper.findAll('tbody tr')

    expect(rows).toHaveLength(2)
    expect(rows[0].text()).not.toContain('Jamais')
    expect(rows[1].text()).toContain('Jamais')
    expect(rows[1].text()).toContain('Archivée')
    expect(rows[0].find('a').attributes('href')).toBe('/fr/admin.organizations.show/1')
  })

  it('signale le fournisseur qui se rabat sur ses membres responsables (#217)', () => {
    const wrapper = renderIndex([item(1, { quoteAddressSource: 'members' }), item(2)])
    const rows = wrapper.findAll('tbody tr')

    expect(rows[0].text()).toContain('Sans adresse de réception')
    expect(rows[1].text()).not.toContain('Sans adresse de réception')
  })

  it('le filtre « sans adresse de réception » passe dans la visite', async () => {
    const wrapper = renderIndex([item(1)])

    await wrapper.find('#organization-missing-quote-address').setValue(true)
    await wrapper.find('form').trigger('submit')

    expect(get).toHaveBeenCalledWith(
      '/fr/admin.organizations.index',
      { page: 1, status: 'active', missingQuoteAddress: true },
      expect.anything()
    )
  })

  it('affiche l’état vide', () => {
    const wrapper = renderIndex([])
    expect(wrapper.text()).toContain('Aucune organisation.')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('le bouton Filtrer émet une visite avec les filtres actifs seulement', async () => {
    const wrapper = renderIndex([item(1)])

    await wrapper.find('#organization-search').setValue('  acme ')
    await wrapper.find('#organization-type').setValue('buyer')
    await wrapper.find('#organization-country').setValue('DE')
    expect(get).not.toHaveBeenCalled()
    await wrapper.find('form').trigger('submit')

    expect(get).toHaveBeenCalledWith(
      '/fr/admin.organizations.index',
      { page: 1, search: 'acme', type: 'buyer', status: 'active', country: 'DE' },
      expect.objectContaining({ preserveState: true, only: ['organizationList', 'filters'] })
    )
  })

  it('resynchronise les champs quand les filtres du serveur changent', async () => {
    const wrapper = renderIndex([item(1)])
    await wrapper.setProps({ filters: { ...NO_FILTERS, status: 'archived', country: 'DE' } })

    expect((wrapper.find('#organization-status').element as HTMLSelectElement).value).toBe(
      'archived'
    )
    expect((wrapper.find('#organization-country').element as HTMLSelectElement).value).toBe('DE')
  })

  it('pagine en conservant les filtres', async () => {
    const wrapper = renderIndex([item(1)], 3, { ...NO_FILTERS, search: 'acme' })

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Suivant')!
      .trigger('click')

    expect(get).toHaveBeenCalledWith(
      '/fr/admin.organizations.index',
      { page: 2, search: 'acme', status: 'active' },
      expect.objectContaining({ only: ['organizationList', 'filters'] })
    )
  })
})

const ROLES: RoleType[] = [
  { id: 10, name: 'Owner', slug: 'owner', description: null },
  { id: 11, name: 'Member', slug: 'member', description: null },
]

function detail(extra: Partial<AdminOrganizationDetail> = {}): AdminOrganizationDetail {
  return {
    ...item(5, { name: 'Acme' }),
    email: 'contact@acme.test',
    phone: null,
    website: null,
    siret: '12345678901234',
    vatNumber: null,
    industry: null,
    size: null,
    description: null,
    addressLine1: null,
    addressLine2: null,
    city: 'Lyon',
    postalCode: null,
    logoUrl: null,
    subscriptionPlan: 'free',
    subscriptions: [],
    locale: 'fr',
    updatedAt: null,
    reviewReasons: null,
    vatVerifiedAt: null,
    domainVerifiedAt: null,
    productsCount: 3,
    rfqsCount: 1,
    members: [
      {
        id: 1,
        membershipId: 101,
        email: 'owner@acme.test',
        fullName: 'Olive Owner',
        roleSlug: 'owner',
        joinedAt: '2026-10-01T10:00:00.000Z',
      },
      {
        id: 2,
        membershipId: 102,
        email: 'jane@acme.test',
        fullName: null,
        roleSlug: 'member',
        joinedAt: '2026-10-02T10:00:00.000Z',
      },
    ],
    pendingInvitations: [
      {
        id: 7,
        email: 'new@acme.test',
        roleSlug: 'member',
        expiresAt: '2026-11-20T10:00:00.000Z',
        invitedByEmail: 'owner@acme.test',
        invitedByName: 'Olive Owner',
      },
    ],
    supplierProfile: null,
    agencyProfile: null,
    billingProfile: null,
    canManage: true,
    ...extra,
  }
}

const mountShow = (organization: AdminOrganizationDetail, roles: RoleType[] = ROLES) =>
  mount(Show, { props: { organization, roles } })
const buttonLabels = (wrapper: ReturnType<typeof mountShow>) =>
  wrapper.findAll('button').map((b) => b.text())
const button = (wrapper: ReturnType<typeof mountShow>, label: string) =>
  wrapper.findAll('button').find((b) => b.text() === label)!

describe('admin/organizations/show', () => {
  beforeEach(() => {
    patch.mockClear()
    post.mockClear()
    del.mockClear()
    formPatch.mockClear()
  })

  it('affiche le titre, les sections, les membres et les invitations', () => {
    const wrapper = mountShow(detail())

    expect(wrapper.find('h1').text()).toBe('Acme')
    expect(wrapper.text()).toContain('Synthèse')
    expect(wrapper.text()).toContain('Olive Owner')
    expect(wrapper.text()).toContain('Sans nom')
    expect(wrapper.text()).toContain('Invitations en attente')
    expect(wrapper.text()).toContain('new@acme.test')
    expect(wrapper.text()).not.toContain('Organisation archivée.')
  })

  it('n’affiche une section de profil que si le profil existe', () => {
    expect(mountShow(detail()).text()).not.toContain('Profil fournisseur')
    expect(mountShow(detail()).text()).not.toContain('Profil agence')

    const wrapper = mountShow(
      detail({
        agencyProfile: {
          id: 1,
          activity: 'sourcing',
          activityOther: null,
          teamSize: null,
          purchaseVolume: null,
          clientSectors: null,
          defaultMarginPercent: null,
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: null,
        },
        reviewReasons: ['no_website'],
        vatVerifiedAt: '2026-10-02T10:00:00.000Z',
        billingProfile: {
          id: 2,
          email: null,
          addressLine1: null,
          addressLine2: null,
          city: 'Paris',
          postalCode: null,
          country: null,
          purchaseOrderReference: null,
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: null,
        },
      })
    )

    expect(wrapper.text()).toContain('Profil agence')
    expect(wrapper.text()).toContain('Pas de site web')
    expect(wrapper.text()).toContain('Non vérifié')
    expect(wrapper.text()).toContain('Facturation')
    expect(wrapper.text()).toContain('Paris')
    expect(wrapper.text()).not.toContain('Profil fournisseur')
  })

  it('sans canManage : aucun formulaire, aucune action, rôle en lecture seule', () => {
    const wrapper = mountShow(detail({ canManage: false }))

    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.text()).toContain('Propriétaire')
    expect(wrapper.text()).toContain('contact@acme.test')
  })

  it('organisation archivée : bandeau visible, restaurer proposé, édition conservée', () => {
    const wrapper = mountShow(detail({ archivedAt: '2026-10-20T10:00:00.000Z' }))

    expect(wrapper.text()).toContain('Organisation archivée.')
    expect(buttonLabels(wrapper)).toContain('Restaurer')
    expect(buttonLabels(wrapper)).not.toContain('Archiver')
    expect(buttonLabels(wrapper)).toContain('Enregistrer')
  })

  it('archiver confirmé envoie un POST', async () => {
    const host = await mountConfirmHost()
    await button(mountShow(detail()), 'Archiver').trigger('click')
    expect(post).not.toHaveBeenCalled()
    await answerConfirm(host, 'confirm')

    expect(post).toHaveBeenCalledWith(
      '/fr/admin.organizations.archive/5',
      {},
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('restaurer confirmé envoie un POST', async () => {
    const host = await mountConfirmHost()
    await button(
      mountShow(detail({ archivedAt: '2026-10-20T10:00:00.000Z' })),
      'Restaurer'
    ).trigger('click')
    await answerConfirm(host, 'confirm')

    expect(post).toHaveBeenCalledWith(
      '/fr/admin.organizations.restore/5',
      {},
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('confirm refusé : aucune requête', async () => {
    const host = await mountConfirmHost()
    const wrapper = mountShow(detail())

    for (const b of wrapper.findAll('button')) {
      if (b.attributes('type') === 'submit') continue
      await b.trigger('click')
      await answerConfirm(host, 'cancel')
    }

    expect(post).not.toHaveBeenCalled()
    expect(del).not.toHaveBeenCalled()
    expect(patch).not.toHaveBeenCalled()
  })

  it('changer le type envoie un PATCH', async () => {
    const wrapper = mountShow(detail())

    await wrapper.find('#organization-type-change').setValue('both')
    await wrapper.findAll('form').at(1)!.trigger('submit')

    expect(patch).toHaveBeenCalledWith(
      '/fr/admin.organizations.change_type/5',
      { organizationType: 'both' },
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('le formulaire d’édition envoie les champs (vides à null) et affiche les erreurs', async () => {
    const wrapper = mountShow(detail())

    expect(wrapper.text()).toContain('SIRET invalide')
    await wrapper.find('#org-name').setValue('  Acme 2 ')
    await wrapper.find('#org-city').setValue('')
    await wrapper.findAll('form')[0].trigger('submit')

    expect(formPatch).toHaveBeenCalledWith(
      '/fr/admin.organizations.update/5',
      expect.objectContaining({
        name: 'Acme 2',
        country: 'FR',
        siret: '12345678901234',
        email: 'contact@acme.test',
        phone: null,
        city: null,
        size: null,
        description: null,
      }),
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('changer le rôle d’un membre envoie un PATCH avec le roleId', async () => {
    const wrapper = mountShow(detail())

    await wrapper.find('#member-role-102').setValue('10')

    expect(patch).toHaveBeenCalledWith(
      '/fr/admin.organizations.member_role/5/102',
      { roleId: 10 },
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('sans la liste des rôles, le rôle reste en lecture seule', () => {
    expect(mountShow(detail(), []).find('#member-role-102').exists()).toBe(false)
  })

  it('retirer un membre confirmé envoie un DELETE', async () => {
    const host = await mountConfirmHost()
    const wrapper = mountShow(detail())

    await wrapper.findAll('button[aria-label="Retirer"]')[1].trigger('click')

    expect(host.find('#confirm-dialog-message').text()).toBe('Retirer jane@acme.test ?')
    await answerConfirm(host, 'confirm')
    expect(del).toHaveBeenCalledWith(
      '/fr/admin.organizations.remove_member/5/102',
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('révoquer une invitation envoie un DELETE', async () => {
    const host = await mountConfirmHost()
    await button(mountShow(detail()), 'Révoquer').trigger('click')
    await answerConfirm(host, 'confirm')

    expect(del).toHaveBeenCalledWith(
      '/fr/admin.organizations.revoke_invitation/5/7',
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('renvoyer une invitation envoie un POST', async () => {
    const host = await mountConfirmHost()
    await button(mountShow(detail()), 'Renvoyer').trigger('click')
    await answerConfirm(host, 'confirm')

    expect(post).toHaveBeenCalledWith(
      '/fr/admin.organizations.resend_invitation/5/7',
      {},
      expect.objectContaining({ preserveScroll: true })
    )
  })
})
