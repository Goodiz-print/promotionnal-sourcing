import { test } from '@japa/runner'
import { verifySvixSignature, svixSignature } from '#services/inbound_mail/svix_signature'
import { InboundMailSignatureException } from '#exceptions/inbound_mail_errors'
import {
  HTML_TEXT_SOURCE_MAX,
  acceptedAttachmentType,
  agencyReplyAddress,
  htmlToText,
  inboundMailBody,
  isAutomaticReply,
  isRelayWindowClosed,
  matchesFileSignature,
  parseMailAddress,
  parseRawHeaders,
  RELAY_TOKEN_FIELDS,
  relayableHeaders,
  relayTargetFrom,
  replyAddress,
  stripQuotedReply,
} from '#shared/helpers/inbound_mail'
import { DateTime } from 'luxon'
import { MESSAGE_MAX_LENGTH } from '#shared/types/conversation'

const TOKEN = '0123456789abcdef0123456789abcdef'

test.group('Mails entrants — adresse relais', () => {
  test('une adresse par côté (#226) : `rfq-` pour le fournisseur, `agency-` pour l’agence', ({
    assert,
  }) => {
    assert.equal(replyAddress(TOKEN, 'reply.test'), `rfq-${TOKEN}@reply.test`)
    assert.equal(agencyReplyAddress(TOKEN, 'reply.test'), `agency-${TOKEN}@reply.test`)
    assert.deepEqual(RELAY_TOKEN_FIELDS, { supplier: 'replyToken', agency: 'agencyReplyToken' })
  })

  test('relayTargetFrom : le préfixe dit qui écrit, le jeton désigne le couple', ({ assert }) => {
    assert.deepEqual(relayTargetFrom([replyAddress(TOKEN, 'reply.test')], 'reply.test'), {
      side: 'supplier',
      token: TOKEN,
    })
    assert.deepEqual(relayTargetFrom([agencyReplyAddress(TOKEN, 'reply.test')], 'reply.test'), {
      side: 'agency',
      token: TOKEN,
    })
  })

  test('relayTargetFrom : sans tenir compte de la casse ni du nom affiché, première adresse relais', ({
    assert,
  }) => {
    const address = replyAddress(TOKEN, 'reply.test')
    const agency = agencyReplyAddress(TOKEN.replace('0', 'f'), 'reply.test')

    assert.equal(relayTargetFrom([`Devis <${address.toUpperCase()}>`], 'reply.test')?.token, TOKEN)
    assert.equal(relayTargetFrom(['autre@exemple.fr', address], 'reply.test')?.side, 'supplier')
    assert.equal(
      relayTargetFrom(['autre@exemple.fr', agency, address], 'reply.test')?.side,
      'agency'
    )
  })

  test('relayTargetFrom : ignore un autre domaine, un autre préfixe ou un jeton mal formé', ({
    assert,
  }) => {
    assert.isNull(relayTargetFrom([`rfq-${TOKEN}@autre.test`], 'reply.test'))
    assert.isNull(relayTargetFrom([`devis-${TOKEN}@reply.test`], 'reply.test'))
    assert.isNull(relayTargetFrom(['rfq-12@reply.test'], 'reply.test'))
    assert.isNull(relayTargetFrom([`rfq-${TOKEN}x@reply.test`], 'reply.test'))
    assert.isNull(relayTargetFrom([`agency-${TOKEN}@autre.test`], 'reply.test'))
    assert.isNull(relayTargetFrom([`agency-rfq-${TOKEN}@reply.test`], 'reply.test'))
    assert.isNull(relayTargetFrom([], 'reply.test'))
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

test.group('Mails entrants — relais (#226)', () => {
  test('relayableHeaders : écarte tout ce qui désigne l’expéditeur', ({ assert }) => {
    const headers = {
      'from': 'Agence Dupont <marie@agence-dupont.fr>',
      'reply-to': 'marie@agence-dupont.fr',
      'sender': 'marie@agence-dupont.fr',
      'return-path': '<bounce@agence-dupont.fr>',
      'received': 'from mail.agence-dupont.fr ([203.0.113.7])',
      'x-originating-ip': '[203.0.113.7]',
      'message-id': '<abc@agence-dupont.fr>',
      'in-reply-to': '<def@reply.test>',
      'references': '<abc@agence-dupont.fr>',
      'dkim-signature': 'v=1; d=agence-dupont.fr',
      'x-mailer': 'Outlook 16 — Agence Dupont',
      'organization': 'Agence Dupont',
      'subject': 'Re: devis Agence Dupont',
      'x-ms-exchange-organization-authas': 'Internal',
    }

    assert.deepEqual(relayableHeaders(headers), {})
  })

  test('relayableHeaders : garde les consignes de priorité, nom canonique', ({ assert }) => {
    assert.deepEqual(
      relayableHeaders({ 'importance': 'high', 'x-priority': '1 (Highest)', 'Priority': 'urgent' }),
      { 'Importance': 'high', 'X-Priority': '1 (Highest)', 'Priority': 'urgent' }
    )
  })

  test('relayableHeaders : une valeur qui n’est pas une simple consigne est écartée', ({
    assert,
  }) => {
    assert.deepEqual(relayableHeaders({ importance: 'high <marie@agence-dupont.fr>' }), {})
    assert.deepEqual(relayableHeaders({ importance: 'h'.repeat(64) }), {})
    assert.deepEqual(relayableHeaders({ 'x-priority': '1\r\nBcc: x@y.fr' }), {})
  })

  test('inboundMailBody : le texte, à défaut le HTML réduit, borné', ({ assert }) => {
    assert.equal(inboundMailBody('  Bonjour  ', '<p>ignoré</p>'), 'Bonjour')
    assert.equal(inboundMailBody('  ', '<p>Bonjour</p><p>Merci</p>'), 'Bonjour\nMerci')
    assert.equal(inboundMailBody(null, null), '')
    assert.lengthOf(inboundMailBody('a'.repeat(MESSAGE_MAX_LENGTH + 10), null), MESSAGE_MAX_LENGTH)
  })

  test('inboundMailBody : sans l’historique cité', ({ assert }) => {
    assert.equal(inboundMailBody('Oui, ça marche.\n\n> Livraison le 15 ?', null), 'Oui, ça marche.')
  })

  test('stripQuotedReply : coupe à la première marque de citation', ({ assert }) => {
    const cases: Array<[string, string]> = [
      ['Merci.\n> ancien', 'Merci.'],
      [
        'Merci.\n\nLe 21 nov. 2026 à 10:02, Plateforme <noreply@x.test> a écrit :\n> ancien',
        'Merci.',
      ],
      [
        'Thanks.\nOn Fri, Nov 21, 2026 at 10:02 AM Platform <noreply@x.test> wrote:\nold',
        'Thanks.',
      ],
      [
        'Merci.\nLe ven. 21 nov. 2026 à 10:02, Plateforme\n<noreply@x.test> a écrit :\nancien',
        'Merci.',
      ],
      ['Danke.\n-----Ursprüngliche Nachricht-----\nalt', 'Danke.'],
      [
        'Merci.\n\nDe : Plateforme <noreply@x.test>\nEnvoyé : vendredi 21 novembre 2026\nancien',
        'Merci.',
      ],
    ]
    cases.forEach(([text, expected]) => assert.equal(stripQuotedReply(text), expected, text))
  })

  test('stripQuotedReply : garde un texte sans citation, ou qui n’est qu’une citation', ({
    assert,
  }) => {
    assert.equal(
      stripQuotedReply('De : notre côté, tout va bien.\nMerci'),
      'De : notre côté, tout va bien.\nMerci'
    )
    assert.equal(stripQuotedReply('> seulement cité'), '> seulement cité')
    assert.equal(stripQuotedReply(''), '')
  })

  test('isRelayWindowClosed : ouverte publiée, puis graceDays après la fin', ({ assert }) => {
    const now = DateTime.fromISO('2026-11-21T12:00:00Z')
    const endedAt = (days: number) => now.minus({ days })

    assert.isFalse(
      isRelayWindowClosed({ status: 'published', closedAt: null, expiredAt: null }, 30, now)
    )
    assert.isFalse(
      isRelayWindowClosed({ status: 'closed', closedAt: endedAt(29), expiredAt: null }, 30, now)
    )
    assert.isTrue(
      isRelayWindowClosed({ status: 'closed', closedAt: endedAt(31), expiredAt: null }, 30, now)
    )
    assert.isTrue(
      isRelayWindowClosed({ status: 'expired', closedAt: null, expiredAt: endedAt(31) }, 30, now)
    )
    assert.isTrue(
      isRelayWindowClosed({ status: 'draft', closedAt: null, expiredAt: null }, 30, now)
    )
  })
})
