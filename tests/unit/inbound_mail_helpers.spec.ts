import { test } from '@japa/runner'
import { verifySvixSignature, svixSignature } from '#services/inbound_mail/svix_signature'
import { InboundMailSignatureException } from '#exceptions/inbound_mail_errors'
import {
  acceptedAttachmentType,
  isAutomaticReply,
  parseMailAddress,
  parseRawHeaders,
  replyAddress,
  replyTokenFrom,
} from '#shared/helpers/inbound_mail'

const TOKEN = '0123456789abcdef0123456789abcdef'

test.group('Mails entrants — adresse relais', () => {
  test('retrouve le jeton, sans tenir compte de la casse ni du nom affiché', ({ assert }) => {
    const address = replyAddress(TOKEN, 'reply.test')

    assert.equal(address, `rfq-${TOKEN}@reply.test`)
    assert.equal(replyTokenFrom([address], 'reply.test'), TOKEN)
    assert.equal(replyTokenFrom([`Devis <${address.toUpperCase()}>`], 'reply.test'), TOKEN)
    assert.equal(replyTokenFrom(['autre@exemple.fr', address], 'reply.test'), TOKEN)
  })

  test('ignore un autre domaine, un autre préfixe ou un jeton mal formé', ({ assert }) => {
    assert.isNull(replyTokenFrom([`rfq-${TOKEN}@autre.test`], 'reply.test'))
    assert.isNull(replyTokenFrom([`devis-${TOKEN}@reply.test`], 'reply.test'))
    assert.isNull(replyTokenFrom(['rfq-12@reply.test'], 'reply.test'))
    assert.isNull(replyTokenFrom([`rfq-${TOKEN}x@reply.test`], 'reply.test'))
  })

  test('décompose un expéditeur', ({ assert }) => {
    assert.deepEqual(parseMailAddress('"Jean Dupont" <Jean@Fournisseur.FR>'), {
      address: 'jean@fournisseur.fr',
      name: 'Jean Dupont',
    })
    assert.deepEqual(parseMailAddress(' jean@fournisseur.fr '), {
      address: 'jean@fournisseur.fr',
      name: null,
    })
  })
})

test.group('Mails entrants — réponses automatiques', () => {
  test('lit les en-têtes d’un mail brut, lignes repliées comprises', ({ assert }) => {
    const raw = [
      'Return-Path: <>',
      'Subject: Absent',
      ' du bureau',
      'Auto-Submitted: auto-replied',
      '',
      'Auto-Submitted: no (dans le corps, ignoré)',
    ].join('\r\n')

    assert.deepEqual(parseRawHeaders(raw), {
      'return-path': '<>',
      'subject': 'Absent du bureau',
      'auto-submitted': 'auto-replied',
    })
  })

  test('reconnaît une absence, un avis de non-remise et un robot', ({ assert }) => {
    assert.isTrue(isAutomaticReply({ 'auto-submitted': 'auto-replied' }, 'jean@f.test'))
    assert.isTrue(isAutomaticReply({ 'x-auto-response-suppress': 'All' }, 'jean@f.test'))
    assert.isTrue(isAutomaticReply({ precedence: 'bulk' }, 'jean@f.test'))
    assert.isTrue(isAutomaticReply({ 'return-path': '<>' }, 'jean@f.test'))
    assert.isTrue(isAutomaticReply({}, 'mailer-daemon@f.test'))
    assert.isTrue(isAutomaticReply({}, 'no-reply@f.test'))
  })

  test('laisse passer une réponse écrite par une personne', ({ assert }) => {
    assert.isFalse(isAutomaticReply({ 'auto-submitted': 'no' }, 'jean@f.test'))
    assert.isFalse(isAutomaticReply({ 'return-path': '<jean@f.test>' }, 'jean@f.test'))
    assert.isFalse(isAutomaticReply({}, 'norbert@f.test'))
  })

  test('n’accepte que les types de pièces jointes prévus', ({ assert }) => {
    assert.equal(acceptedAttachmentType('Devis 2026.PDF'), 'application/pdf')
    assert.equal(acceptedAttachmentType('photo.jpeg'), 'image/jpeg')
    assert.isNull(acceptedAttachmentType('macro.xlsm'))
    assert.isNull(acceptedAttachmentType('installeur.exe'))
    assert.isNull(acceptedAttachmentType('sans-extension'))
  })
})

/** Vecteur de test de la documentation Svix (vérification manuelle). */
const SVIX = {
  secret: 'whsec_plJ3nmyCDGBKInavdOK15jsl',
  id: 'msg_loFOjxBNrRLzqYUf',
  timestamp: '1731705121',
  rawBody: '{"event_type":"ping","data":{"success":true}}',
  signature: 'v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=',
  toleranceSeconds: 300,
  now: new Date(1731705121 * 1000),
}

test.group('Mails entrants — signature du webhook (Svix)', () => {
  test('accepte le vecteur de la documentation', ({ assert }) => {
    assert.doesNotThrow(() => verifySvixSignature(SVIX))
    assert.equal(svixSignature(SVIX.secret, SVIX.id, SVIX.timestamp, SVIX.rawBody), SVIX.signature)
  })

  test('accepte une signature valide parmi plusieurs', ({ assert }) => {
    const signature = `v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= ${SVIX.signature}`
    assert.doesNotThrow(() => verifySvixSignature({ ...SVIX, signature }))
  })

  test('refuse un corps modifié, un en-tête manquant ou un horodatage ancien', ({ assert }) => {
    const rejected = (request: Parameters<typeof verifySvixSignature>[0]) =>
      assert.throws(() => verifySvixSignature(request), /Inbound mail webhook rejected/)

    rejected({ ...SVIX, rawBody: SVIX.rawBody.replace('true', 'false') })
    rejected({ ...SVIX, signature: undefined })
    rejected({ ...SVIX, id: undefined })
    rejected({ ...SVIX, now: new Date((1731705121 + 301) * 1000) })
    rejected({ ...SVIX, signature: 'v2,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=' })
    assert.throws(
      () => verifySvixSignature({ ...SVIX, signature: 'v1,nope' }),
      InboundMailSignatureException
    )
  })
})
