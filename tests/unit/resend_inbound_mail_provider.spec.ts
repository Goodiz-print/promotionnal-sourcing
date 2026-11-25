import { test } from '@japa/runner'
import inboundMailConfig from '#config/inbound_mail'
import {
  InboundMailProviderException,
  InboundMailSignatureException,
} from '#exceptions/inbound_mail_errors'
import ResendInboundMailProvider from '#services/inbound_mail/resend_inbound_mail_provider'
import { svixSignature } from '#services/inbound_mail/svix_signature'

const SECRET = 'whsec_plJ3nmyCDGBKInavdOK15jsl'
const API = 'https://api.resend.com'
const FILES = 'https://files.resend.test'

/** Événement `email.received`, tel que la documentation de Resend le décrit. */
const EVENT = {
  type: 'email.received',
  created_at: '2026-11-13T08:30:01.000Z',
  data: {
    email_id: '56761188-7520-42d8-8898-ff6fc54ce618',
    created_at: '2026-11-13 08:30:00.894719+00',
    from: 'Jean Dupont <jean@fournisseur.test>',
    to: ['Demande <rfq-0123456789abcdef0123456789abcdef@reply.test>'],
    cc: ['achats@agence.test'],
    bcc: [],
    received_for: ['rfq-0123456789abcdef0123456789abcdef@reply.test'],
    message_id: '<abc@fournisseur.test>',
    subject: 'Re: demande de devis',
  },
}

/** Requête de webhook signée comme le fait Svix, à l'instant présent. */
function signed(event: unknown, secret = SECRET) {
  const rawBody = JSON.stringify(event)
  const timestamp = String(Math.floor(Date.now() / 1000))
  return {
    rawBody,
    headers: {
      'svix-id': 'msg_1',
      'svix-timestamp': timestamp,
      'svix-signature': svixSignature(secret, 'msg_1', timestamp, rawBody),
    },
  }
}

interface Call {
  url: string
  headers: Record<string, string>
}

test.group('Mails entrants — prestataire Resend', (group) => {
  let calls: Call[] = []
  let routes: Record<string, () => Response> = {}

  group.each.setup(() => {
    const previous = { ...inboundMailConfig }
    const realFetch = globalThis.fetch
    Object.assign(inboundMailConfig, { signingKey: SECRET, apiKey: 're_test_key' })
    calls = []
    routes = {}
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> })
      return routes[url]?.() ?? new Response('not found', { status: 404 })
    }) as typeof fetch

    return () => {
      Object.assign(inboundMailConfig, previous)
      globalThis.fetch = realFetch
    }
  })

  test('lit un webhook `email.received` signé', ({ assert }) => {
    const { rawBody, headers } = signed(EVENT)

    const notification = new ResendInboundMailProvider().parseWebhook(rawBody, headers)

    assert.deepEqual(notification, {
      providerMessageId: EVENT.data.email_id,
      recipients: [...EVENT.data.received_for, ...EVENT.data.to, ...EVENT.data.cc],
      from: EVENT.data.from,
      subject: EVENT.data.subject,
      messageId: EVENT.data.message_id,
      receivedAt: EVENT.data.created_at,
    })
  })

  test('refuse une signature faite avec un autre secret, ignore un autre événement', ({
    assert,
  }) => {
    const provider = new ResendInboundMailProvider()
    const forged = signed(EVENT, 'whsec_YXV0cmUgc2VjcmV0IGRlIHRlc3Q=')
    assert.throws(
      () => provider.parseWebhook(forged.rawBody, forged.headers),
      InboundMailSignatureException
    )

    const other = signed({ ...EVENT, type: 'email.delivered' })
    assert.isNull(provider.parseWebhook(other.rawBody, other.headers))
  })

  test('lit le contenu par l’API et complète les en-têtes avec le début du mail brut', async ({
    assert,
  }) => {
    const eml = 'Auto-Submitted: auto-replied\r\nSubject: Absent\r\n\r\ncorps'
    routes[`${API}/emails/receiving/mail-1`] = () =>
      Response.json({
        html: '<p>Bonjour</p>',
        text: 'Bonjour',
        headers: { 'Subject': 'Re: devis', 'X-Mailer': 'Outlook' },
        raw: { download_url: `${FILES}/mail-1.eml` },
        attachments: [
          { id: 'att-1', filename: 'devis.pdf', content_type: 'application/pdf', size: 1200 },
          {
            id: 'att-2',
            filename: 'logo.png',
            content_type: 'image/png',
            content_disposition: 'inline',
            content_id: 'logo',
            size: 300,
          },
        ],
      })
    // Le serveur honore `Range` : 206, taille totale dans `Content-Range`.
    routes[`${FILES}/mail-1.eml`] = () =>
      new Response(eml, {
        status: 206,
        headers: { 'content-range': `bytes 0-${eml.length - 1}/31000000` },
      })

    const content = await new ResendInboundMailProvider().fetchContent('mail-1')

    assert.equal(content.text, 'Bonjour')
    assert.equal(content.html, '<p>Bonjour</p>')
    assert.equal(content.headers['auto-submitted'], 'auto-replied')
    assert.equal(content.headers['x-mailer'], 'Outlook')
    // Taille du mail entier, sans l'avoir téléchargé.
    assert.equal(content.sizeBytes, 31_000_000)
    assert.deepEqual(content.attachments, [
      {
        id: 'att-1',
        filename: 'devis.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1200,
        inline: false,
      },
      { id: 'att-2', filename: 'logo.png', contentType: 'image/png', sizeBytes: 300, inline: true },
    ])
    assert.equal(calls[0].headers.Authorization, 'Bearer re_test_key')
    assert.match(calls[1].headers.Range, /^bytes=0-\d+$/)
    // L'URL signée du fichier ne reçoit pas la clé d'API.
    assert.notProperty(calls[1].headers, 'Authorization')
  })

  test('un serveur qui ignore `Range` ne fait lire que le début du mail', async ({ assert }) => {
    const eml = `Precedence: bulk\r\n\r\n${'x'.repeat(1024 * 1024)}`
    routes[`${API}/emails/receiving/mail-1`] = () =>
      Response.json({ text: 'Bonjour', raw: { download_url: `${FILES}/mail-1.eml` } })
    routes[`${FILES}/mail-1.eml`] = () =>
      new Response(eml, { headers: { 'content-length': String(eml.length) } })

    const content = await new ResendInboundMailProvider().fetchContent('mail-1')

    assert.equal(content.headers['precedence'], 'bulk')
    assert.equal(content.sizeBytes, eml.length)
    assert.deepEqual(content.attachments, [])
  })

  test('télécharge une pièce jointe par son URL signée', async ({ assert }) => {
    routes[`${API}/emails/receiving/mail-1/attachments/att-1`] = () =>
      Response.json({ id: 'att-1', download_url: `${FILES}/att-1` })
    routes[`${FILES}/att-1`] = () => new Response('%PDF-1.7 devis')

    const file = await new ResendInboundMailProvider().fetchAttachment('mail-1', 'att-1')

    assert.equal(file.toString(), '%PDF-1.7 devis')
  })

  test('une erreur de l’API remonte avec son statut, pour que le job soit rejoué', async ({
    assert,
  }) => {
    routes[`${API}/emails/receiving/mail-1`] = () => new Response('oops', { status: 503 })

    await assert.rejects(
      () => new ResendInboundMailProvider().fetchContent('mail-1'),
      InboundMailProviderException
    )
  })
})
