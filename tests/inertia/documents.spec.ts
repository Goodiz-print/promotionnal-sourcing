import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { answerConfirm, mountConfirmHost } from './support/confirm_dialog'
import type { DocumentType, OrganizationDocumentType } from '#shared/types/document'

const translations = {
  'documents.add': 'Ajouter',
  'documents.remove': 'Retirer',
  'documents.confirmRemove': 'Retirer « {name} » ?',
  'documents.fields.kind': 'Nature du document',
  'documents.fields.file': 'Fichier PDF',
  'documents.kinds.catalogue': 'Catalogue',
  'documents.kinds.certificate': 'Certificat',
  'documents.kinds.other': 'Autre',
}

const post = vi.fn()
const destroy = vi.fn()

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    useForm: m.makeUseForm({ post }),
    router: { delete: destroy },
  }
})

const { default: DocumentManager } = await import('~/components/documents/document_manager.vue')

const documents: OrganizationDocumentType[] = [
  {
    id: 7,
    kind: 'certificate',
    originalName: 'iso-9001.pdf',
    sizeBytes: 3 * 1024 * 1024,
    url: 'https://cellar.test/iso.pdf',
  },
]

function mountManager(kinds?: readonly string[]) {
  return mount(DocumentManager, {
    props: {
      documents,
      kinds,
      storeUrl: '/fr/supplier/profile/documents',
      destroyUrl: (document: { id: number }) => `/fr/supplier/profile/documents/${document.id}`,
      labelFor: (document: DocumentType) => `kind:${(document as OrganizationDocumentType).kind}`,
      title: 'Documents',
      emptyLabel: 'Aucun document.',
    },
  })
}

beforeEach(() => {
  post.mockClear()
  destroy.mockClear()
})

describe('documents/document_manager', () => {
  it('liste les documents avec lien, taille et nature', () => {
    const wrapper = mountManager(['catalogue', 'certificate'])

    expect(wrapper.find('a[href="https://cellar.test/iso.pdf"]').text()).toBe('iso-9001.pdf')
    expect(wrapper.text()).toContain('3.0 MB')
    expect(wrapper.text()).toContain('kind:certificate')
  })

  it("affiche l'état vide sans document", () => {
    const wrapper = mount(DocumentManager, {
      props: {
        documents: [],
        storeUrl: '/x',
        destroyUrl: () => '/x',
        title: 'Documents',
        emptyLabel: 'Aucun document.',
      },
    })
    expect(wrapper.text()).toContain('Aucun document.')
  })

  it("n'affiche le choix de nature que si des natures sont proposées", () => {
    expect(mountManager(['catalogue', 'other']).find('#document-kind').exists()).toBe(true)
    expect(mountManager().find('#document-kind').exists()).toBe(false)
  })

  it("désactive l'ajout tant qu'aucun fichier n'est choisi puis poste en multipart", async () => {
    const wrapper = mountManager(['catalogue'])
    const submit = wrapper.find('button[type="submit"]')
    expect(submit.attributes('disabled')).toBeDefined()

    const input = wrapper.find('#document-file')
    const file = new File(['%PDF-1.4'], 'catalogue.pdf', { type: 'application/pdf' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')

    expect(wrapper.text()).toContain('catalogue.pdf')
    expect(submit.attributes('disabled')).toBeUndefined()

    await wrapper.find('form').trigger('submit')
    expect(post).toHaveBeenCalledWith(
      '/fr/supplier/profile/documents',
      expect.objectContaining({ forceFormData: true, preserveScroll: true })
    )
  })

  it('retire un document après confirmation', async () => {
    const host = await mountConfirmHost()
    const wrapper = mountManager(['catalogue'])

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Retirer')!
      .trigger('click')
    expect(host.find('#confirm-dialog-message').text()).toContain('Retirer « ')
    await answerConfirm(host, 'confirm')

    expect(destroy).toHaveBeenCalledWith('/fr/supplier/profile/documents/7', {
      preserveScroll: true,
    })
  })

  it('ne retire rien si la confirmation est refusée', async () => {
    const host = await mountConfirmHost()
    const wrapper = mountManager(['catalogue'])

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Retirer')!
      .trigger('click')
    await answerConfirm(host, 'cancel')

    expect(destroy).not.toHaveBeenCalled()
  })
})
