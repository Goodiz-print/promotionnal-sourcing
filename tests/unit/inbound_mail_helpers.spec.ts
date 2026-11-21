import { test } from '@japa/runner'
import { verifySvixSignature, svixSignature } from '#services/inbound_mail/svix_signature'
import { InboundMailSignatureException } from '#exceptions/inbound_mail_errors'
import {
  HTML_TEXT_SOURCE_MAX,
  acceptedAttachmentType,
  agencyReplyAddress,
  htmlToText,
  isAutomaticReply,
  matchesFileSignature,
  parseMailAddress,
  parseRawHeaders,
  replyAddress,
  replyTokenFrom,
} from '#shared/helpers/inbound_mail'

const TOKEN = '0123456789abcdef0123456789abcdef'

test.group('Mails entrants — adresse relais', () => {
  test('l’adresse côté agence (#225) porte le même jeton, sans être prise pour celle du fournisseur', ({
    assert,
  }) => {
    const address = agencyReplyAddress(TOKEN, 'reply.test')

    assert.equal(address, `agency-${TOKEN}@reply.test`)
    // Tant que #226 ne la route pas, une réponse de l'agence n'entre pas dans le fil.
    assert.isNull(replyTokenFrom([address], 'reply.test'))
    assert.notEqual(address, replyAddress(TOKEN, 'reply.test'))
  })

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
    // Posé par des CRM et des ERP sur des mails écrits par une personne.
    assert.isFalse(
      isAutomaticReply({ 'x-auto-response-suppress': 'OOF, AutoReply' }, 'jean@f.test')
    )
  })

  test('n’accepte que les types de pièces jointes prévus', ({ assert }) => {
    assert.equal(acceptedAttachmentType('Devis 2026.PDF'), 'application/pdf')
    assert.equal(acceptedAttachmentType('photo.jpeg'), 'image/jpeg')
    assert.isNull(acceptedAttachmentType('macro.xlsm'))
    assert.isNull(acceptedAttachmentType('installeur.exe'))
    assert.isNull(acceptedAttachmentType('sans-extension'))
  })

  test('vérifie que le contenu est du format annoncé par l’extension', ({ assert }) => {
    const bytes = (...values: Array<number | string>) =>
      Buffer.concat(values.map((v) => (typeof v === 'string' ? Buffer.from(v) : Buffer.from([v]))))
    const zip = bytes('PK', 3, 4, 'contenu')

    assert.isTrue(matchesFileSignature('pdf', bytes('%PDF-1.7')))
    assert.isTrue(matchesFileSignature('png', bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a)))
    assert.isTrue(matchesFileSignature('jpeg', bytes(0xff, 0xd8, 0xff, 0xe0)))
    assert.isTrue(matchesFileSignature('webp', bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 ')))
    assert.isTrue(matchesFileSignature('xlsx', zip))
    assert.isTrue(matchesFileSignature('odt', zip))
    assert.isTrue(
      matchesFileSignature('xls', bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1))
    )
    assert.isTrue(matchesFileSignature('csv', bytes('ref;prix\nA1;12,50\n')))

    // Exécutable renommé, autre format RIFF, binaire en `.csv`, fichier vide.
    assert.isFalse(matchesFileSignature('pdf', bytes('MZ', 0x90, 0)))
    assert.isFalse(matchesFileSignature('webp', bytes('RIFF', 0, 0, 0, 0, 'WAVEfmt ')))
    assert.isFalse(matchesFileSignature('csv', bytes('MZ', 0, 0)))
    assert.isFalse(matchesFileSignature('docx', bytes()))
    assert.isFalse(matchesFileSignature('exe', bytes('MZ')))
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

test.group('Mails entrants — corps HTML réduit à du texte', () => {
  test('retire balises, styles et scripts, garde les retours à la ligne', ({ assert }) => {
    const html =
      '<html><head><title>x</title></head><body><script>alert(1)</script>' +
      '<div>Bonjour,</div><p>Prix&nbsp;: 12 &euro; &amp; port &lt;offert&gt;<br/>Délai&#32;: 3 semaines</p>' +
      '<ul><li>Coton</li><li>Bio</li></ul></body></html>'

    assert.equal(
      htmlToText(html),
      'Bonjour,\nPrix : 12 € & port <offert>\nDélai : 3 semaines\nCoton\nBio'
    )
  })

  test('décode les entités numériques, et laisse telle quelle une entité invalide', ({
    assert,
  }) => {
    assert.equal(htmlToText('<p>12 &#x20AC; ou 12 &#8364;</p>'), '12 € ou 12 €')
    // Code hors d'Unicode, ou moitié de paire de substitution : jamais d'erreur.
    assert.equal(htmlToText('a&#99999999;b &#55296; &#0;'), 'a&#99999999;b &#55296; &#0;')
  })

  test('un HTML malformé ou démesuré est traité en temps linéaire', ({ assert }) => {
    const hostile = [
      `<p>a${' '.repeat(HTML_TEXT_SOURCE_MAX)}b</p>`,
      '<'.repeat(HTML_TEXT_SOURCE_MAX),
      '<style>'.repeat(HTML_TEXT_SOURCE_MAX / 7),
      '&#'.repeat(HTML_TEXT_SOURCE_MAX / 2),
    ]

    const started = Date.now()
    const texts = hostile.map((html) => htmlToText(html))

    assert.isBelow(Date.now() - started, 1000)
    assert.equal(texts[0], 'a')
    assert.equal(texts[1], '')
    assert.equal(texts[2], '')
  })

  test('une balise jamais fermée ne laisse pas passer son contenu', ({ assert }) => {
    assert.equal(htmlToText('Bonjour<script>alert(1)'), 'Bonjour')
    assert.equal(htmlToText('Bonjour <img src="x" onerror="alert(1)'), 'Bonjour')
  })

  test('un HTML sans texte donne une chaîne vide', ({ assert }) => {
    assert.equal(htmlToText('<p><img src="cid:logo"></p>'), '')
  })
})
