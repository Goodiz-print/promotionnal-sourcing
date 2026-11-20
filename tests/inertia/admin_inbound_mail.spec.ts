import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type {
  AdminInboundMailAttachment,
  AdminInboundMailRecipient,
} from '#shared/types/admin_inbound_mail'

const translations = {
  'admin.inboundMail.statuses.rejected': 'Écarté',
  'admin.inboundMail.statuses.processed': 'Traité',
  'admin.inboundMail.rejections.unknown_address': 'Adresse inconnue',
  'admin.inboundMail.columns.actions': 'Actions',
  'admin.inboundMail.actions.attach': 'Rattacher',
  'admin.inboundMail.actions.attachConfirm': 'Rattacher ?',
  'admin.inboundMail.attach.title': 'Rattacher à une demande',
  'admin.inboundMail.attach.description': 'Suggestions.',
  'admin.inboundMail.attach.rfqLabel': 'Numéro de demande',
  'admin.inboundMail.attach.rfqHint': 'Vide : suggestions.',
  'admin.inboundMail.attach.search': 'Chercher',
  'admin.inboundMail.attach.empty': 'Aucune demande à proposer.',
  'admin.inboundMail.attach.emptyDescription': 'Saisissez le numéro.',
  'admin.inboundMail.attach.columns.rfq': 'Demande',
  'admin.inboundMail.attach.columns.supplier': 'Fournisseur',
  'admin.inboundMail.attach.columns.sentAt': 'Envoyée le',
  'admin.inboundMail.attachments.title': 'Pièces jointes',
  'admin.inboundMail.attachments.empty': 'Aucune pièce jointe journalisée.',
  'admin.inboundMail.attachments.columns.filename': 'Fichier',
  'admin.inboundMail.attachments.columns.type': 'Type',
  'admin.inboundMail.attachments.columns.size': 'Taille',
  'admin.inboundMail.attachments.columns.status': 'Sort',
  'admin.inboundMail.attachments.statuses.stored': 'Stockée',
  'admin.inboundMail.attachments.statuses.rejected_type': 'Type refusé',
}

const post = vi.hoisted(() => vi.fn())
const get = vi.hoisted(() => vi.fn())
vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    router: { get, post },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({
  urlFor: (name: string, params: Record<string, string>) =>
    `/fr/${name}${params.id ? `/${params.id}` : ''}`,
}))

import InboundMailAttach from '~/components/admin/inbound_mail/inbound_mail_attach.vue'
import InboundMailAttachments from '~/components/admin/inbound_mail/inbound_mail_attachments.vue'
import InboundMailStatusBadge from '~/components/admin/inbound_mail/inbound_mail_status_badge.vue'

const CANDIDATE: AdminInboundMailRecipient = {
  rfqSupplierId: 42,
  rfqId: 7,
  rfqTitle: 'Tote bags salon',
  supplierName: 'Fournisseur SA',
  status: 'sent',
  sentAt: null,
}

describe('Mails entrants — état', () => {
  it('nomme l’état et le motif de rejet', () => {
    const rejected = mount(InboundMailStatusBadge, {
      props: { status: 'rejected', rejectionReason: 'unknown_address' },
    })
    expect(rejected.text()).toContain('Écarté')
    expect(rejected.text()).toContain('Adresse inconnue')

    const processed = mount(InboundMailStatusBadge, { props: { status: 'processed' } })
    expect(processed.text()).toBe('Traité')
  })
})

describe('Mails entrants — rattachement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rattache au couple choisi après confirmation', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    const wrapper = mount(InboundMailAttach, {
      props: { mailId: 3, candidates: [CANDIDATE], rfqSearch: null },
    })

    expect(wrapper.text()).toContain('Tote bags salon')
    expect(wrapper.text()).toContain('Fournisseur SA')
    const attach = wrapper.findAll('button').find((button) => button.text() === 'Rattacher')!
    await attach.trigger('click')

    expect(post).toHaveBeenCalledWith(
      '/fr/admin.inbound_mail.attach/3',
      { rfqSupplierId: 42 },
      { preserveScroll: true }
    )
  })

  it('sans suggestion, invite à chercher la demande par son numéro', () => {
    const wrapper = mount(InboundMailAttach, {
      props: { mailId: 3, candidates: [], rfqSearch: null },
    })
    expect(wrapper.text()).toContain('Aucune demande à proposer.')
    expect(wrapper.find('table').exists()).toBe(false)
  })
})

describe('Mails entrants — pièces jointes', () => {
  it('liste chaque pièce et son sort', () => {
    const attachments: AdminInboundMailAttachment[] = [
      {
        id: 1,
        filename: 'devis.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        status: 'stored',
      },
      { id: 2, filename: 'virus.exe', mimeType: null, sizeBytes: null, status: 'rejected_type' },
    ]
    const text = mount(InboundMailAttachments, { props: { attachments } }).text()
    expect(text).toContain('devis.pdf')
    expect(text).toContain('Stockée')
    expect(text).toContain('Type refusé')
  })
})
