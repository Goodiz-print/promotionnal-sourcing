import { test } from '@japa/runner'
import { supplierReplyMail } from '#shared/helpers/supplier_reply'
import type { SupplierReplyMailInput } from '#shared/types/supplier_reply'

const INPUT: SupplierReplyMailInput = {
  notice: {
    rfqId: 4,
    rfqTitle: 'Tote bags',
    supplierName: 'Textiles SA',
    messageId: 12,
    body: 'Voici notre devis.',
    documents: [
      { id: 7, filename: 'devis.pdf' },
      { id: 8, filename: 'annexe.pdf' },
    ],
    replyTo: 'agency-abc@reply.test',
  },
  user: { userId: 3, email: 'Alice@Agence.test', locale: 'en' },
  paths: {
    rfqPath: '/en/rfqs/4',
    documentPaths: { 7: '/en/quote-documents/7/download', 8: '/en/quote-documents/8/download' },
  },
}

test.group('Réponse fournisseur — charge du mail transmis à l’agence (#225)', () => {
  test('destinataire, langue, fournisseur, texte, liens et Reply-To', ({ assert }) => {
    const payload = supplierReplyMail(INPUT)

    assert.equal(payload.kind, 'supplier-reply-received')
    assert.equal(payload.to, 'Alice@Agence.test')
    assert.equal(payload.locale, 'en')
    assert.deepEqual(payload.data, {
      supplierName: 'Textiles SA',
      rfqTitle: 'Tote bags',
      body: 'Voici notre devis.',
      documents: [
        { filename: 'devis.pdf', downloadPath: '/en/quote-documents/7/download' },
        { filename: 'annexe.pdf', downloadPath: '/en/quote-documents/8/download' },
      ],
      rfqPath: '/en/rfqs/4',
      replyTo: 'agency-abc@reply.test',
    })
  })

  test('la clé d’idempotence porte le message et le destinataire, insensible à la casse', ({
    assert,
  }) => {
    const key = supplierReplyMail(INPUT).idempotencyKey
    const otherCase = supplierReplyMail({
      ...INPUT,
      user: { ...INPUT.user, email: 'alice@agence.test' },
    })
    const otherMessage = supplierReplyMail({ ...INPUT, notice: { ...INPUT.notice, messageId: 13 } })

    assert.equal(key, 'supplier-reply-received:message=12:to=alice@agence.test')
    assert.equal(otherCase.idempotencyKey, key)
    assert.notEqual(otherMessage.idempotencyKey, key)
  })

  test('un devis sans chemin n’est pas cité', ({ assert }) => {
    const payload = supplierReplyMail({
      ...INPUT,
      paths: { ...INPUT.paths, documentPaths: { 7: '/en/quote-documents/7/download' } },
    })

    assert.deepEqual(payload.kind === 'supplier-reply-received' ? payload.data.documents : [], [
      { filename: 'devis.pdf', downloadPath: '/en/quote-documents/7/download' },
    ])
  })
})
