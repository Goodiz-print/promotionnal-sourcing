import { test } from '@japa/runner'
import mail from '@adonisjs/mail/services/main'
import type { ApiClient } from '@japa/api-client'
import ContactRequestNotification from '#mails/contact_request_notification'
import { CONTACT_REQUEST_LIMIT } from '#start/limiter'
import { CONTACT_EMAIL, PARTNERS_EMAIL } from '#shared/types/marketing'
import aiConfig from '#config/ai'
import { PRIVACY_PROCESSOR_BODY_KEYS, type LlmProvider } from '#shared/types/ai'
import { UserFactory } from '#database/factories/user_factory'
import { useDatabase } from '#tests/utils/setup'

const PAGES = ['', '/contact', '/legal', '/privacy', '/thanks'] as const

test.group('Landing — pages publiques', (group) => {
  useDatabase(group, { seed: 'none' })

  for (const locale of ['fr', 'en'] as const) {
    for (const page of PAGES) {
      test(`/${locale}${page} répond 200 avec la bonne locale`, async ({ client }) => {
        const response = await client.get(`/${locale}${page}`).withInertia()

        response.assertStatus(200)
        response.assertInertiaPropsContains({ locale })
      })
    }
  }

  test("l'accueil expose les traductions de la landing dans chaque langue", async ({
    client,
    assert,
  }) => {
    const fr = await client.get('/fr').withInertia()
    const en = await client.get('/en').withInertia()

    assert.include(fr.inertiaProps.translations['landing.hero.titleWord1'], 'Simplifié')
    assert.include(en.inertiaProps.translations['landing.hero.titleWord1'], 'Simplified')
    assert.exists(fr.inertiaProps.translations['legal.sections.editeur.title'])
    assert.exists(en.inertiaProps.translations['privacy.sections.responsable.title'])
  })

  test('la page de remerciement est rendue par le composant marketing/thanks', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/fr/thanks').withInertia()

    assert.equal(response.inertiaComponent, 'marketing/thanks')
    assert.match(response.inertiaProps.siteUrl, /^https?:\/\//)
  })

  test('une locale non supportée renvoie 404 sur les pages de la landing', async ({ client }) => {
    const response = await client.get('/ru/contact').redirects(0)

    response.assertStatus(404)
  })

  test("un utilisateur connecté peut consulter la landing (pas de redirection vers l'app)", async ({
    client,
  }) => {
    const user = await UserFactory.create()
    const response = await client.get('/fr').withInertia().loginAs(user)

    response.assertStatus(200)
  })

  test("l'accueil expose les catégories mises en avant et les textes de découverte", async ({
    client,
    assert,
  }) => {
    const response = await client.get('/fr').withInertia()

    response.assertStatus(200)
    assert.isArray(response.inertiaProps.featuredCategories)
    assert.isAtMost(response.inertiaProps.featuredCategories.length, 6)
    assert.exists(response.inertiaProps.translations['landing.discover.searchSubmit'])
  })
})

test.group('Landing — rendu HTML (SSR)', () => {
  test("l'accueil est rendu côté serveur avec un lien de connexion vers /fr/login", async ({
    client,
    assert,
  }) => {
    const response = await client.get('/fr')

    response.assertStatus(200)
    assert.include(response.text(), 'Simplifié.')
    assert.include(response.text(), 'href="/fr/login"')
    assert.include(response.text(), 'rel="canonical"')
  })

  test('la version anglaise pointe vers /en/login et les pages légales sont rendues', async ({
    client,
    assert,
  }) => {
    const home = await client.get('/en')
    assert.include(home.text(), 'href="/en/login"')

    const legal = await client.get('/fr/legal')
    legal.assertStatus(200)
    assert.include(legal.text(), 'Éditeur du site')

    const privacy = await client.get('/en/privacy')
    privacy.assertStatus(200)
  })

  test('la politique de confidentialité nomme le sous-traitant IA configuré', async ({
    client,
    assert,
    cleanup,
  }) => {
    const saved = aiConfig.provider
    cleanup(() => void (aiConfig.provider = saved))
    const pageWith = async (provider: LlmProvider) => {
      aiConfig.provider = provider
      const response = await client.get('/fr/privacy').withInertia()
      const props = response.inertiaProps
      assert.equal(props.aiProcessor, provider)
      const key = `privacy.sections.destinataires.${PRIVACY_PROCESSOR_BODY_KEYS[provider]}`
      return props.translations[key] as string
    }

    const mistral = await pageWith('mistral')
    assert.include(mistral, 'Mistral AI SAS')
    assert.notInclude(mistral, 'Anthropic')

    const claude = await pageWith('claude')
    assert.include(claude, 'Anthropic PBC')
    assert.include(claude, 'États-Unis')
    assert.notInclude(claude, 'Mistral')
  })
})

test.group('Landing — balise title', () => {
  test('une seule balise <title>, celle de la page (repli générique sinon)', async ({
    client,
    assert,
  }) => {
    const titles = async (url: string) => {
      const response = await client.get(url)
      return response.text().match(/<title[^>]*>[^<]*<\/title>/g) ?? []
    }

    const thanks = await titles('/fr/thanks')
    assert.lengthOf(thanks, 1)
    assert.include(thanks[0], 'Message bien reçu')

    const login = await titles('/fr/login')
    assert.lengthOf(login, 1)
  })
})

test.group('Landing — anciennes URLs du site Astro', () => {
  const redirects: [string, string][] = [
    ['/contact', '/fr/contact'],
    ['/mentions-legales', '/fr/legal'],
    ['/politique-de-confidentialite', '/fr/privacy'],
    ['/merci', '/fr/thanks'],
    ['/en/legal-notice', '/en/legal'],
    ['/en/privacy-policy', '/en/privacy'],
    ['/en/thank-you', '/en/thanks'],
  ]

  for (const [from, to] of redirects) {
    test(`${from} redirige en 301 vers ${to}`, async ({ client }) => {
      const response = await client.get(from).redirects(0)

      response.assertStatus(301)
      response.assertHeader('location', to)
    })
  }
})

test.group('Landing — sitemap', () => {
  test('le sitemap liste les pages indexables dans chaque langue, sans la page de remerciement', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/sitemap.xml')

    response.assertStatus(200)
    assert.include(response.header('content-type'), 'application/xml')
    assert.include(response.text(), '/fr/contact</loc>')
    assert.include(response.text(), '/en/privacy</loc>')
    assert.include(response.text(), 'hreflang="en"')
    assert.notInclude(response.text(), '/thanks')
  })
})

test.group('Landing — formulaire de contact', (group) => {
  useDatabase(group, { seed: 'none' })

  let fakeMailer: ReturnType<typeof mail.fake>
  group.each.setup(() => {
    fakeMailer = mail.fake()
    return () => mail.restore()
  })

  const VALID = {
    type: 'contact',
    name: 'Camille Durand',
    company: 'Agence Bleue',
    email: 'Camille@Agence-Bleue.fr',
    phone: '06 12 34 56 78',
    message: 'Nous cherchons 500 tote bags en coton bio.',
  }

  const post = (client: ApiClient, body: object) =>
    client.post('/fr/contact').redirects(0).withCsrfToken().json(body)

  test('une demande de contact part vers contact@ avec le visiteur en reply-to', async ({
    client,
    assert,
  }) => {
    const response = await post(client, VALID)

    response.assertStatus(302)
    assert.equal(response.header('location'), '/fr/thanks')
    fakeMailer.mails.assertSentCount(ContactRequestNotification, 1)
    fakeMailer.mails.assertSent(ContactRequestNotification, ({ message }) => {
      assert.isTrue(message.hasTo(CONTACT_EMAIL))
      assert.isTrue(message.hasReplyTo('camille@agence-bleue.fr', 'Camille Durand'))
      assert.isTrue(message.hasSubject('[Site] Demande de contact — Agence Bleue'))
      return true
    })
  })

  test('une demande de partenariat est routée vers partners@', async ({ client, assert }) => {
    await post(client, { ...VALID, type: 'partnership' })

    fakeMailer.mails.assertSent(ContactRequestNotification, ({ message }) => {
      assert.isTrue(message.hasTo(PARTNERS_EMAIL))
      assert.isTrue(message.hasSubject('[Site] Demande de partenariat — Agence Bleue'))
      return true
    })
  })

  test('un champ piège rempli reçoit la même réponse sans rien envoyer', async ({
    client,
    assert,
  }) => {
    const response = await post(client, { ...VALID, botField: 'http://spam.example' })

    response.assertStatus(302)
    assert.equal(response.header('location'), '/fr/thanks')
    fakeMailer.mails.assertNoneSent()
  })

  test('une demande invalide revient sur le formulaire sans envoi', async ({ client, assert }) => {
    const response = await post(client, { ...VALID, email: 'pas-un-email', message: '' })

    response.assertStatus(302)
    assert.notEqual(response.header('location'), '/fr/thanks')
    fakeMailer.mails.assertNoneSent()
  })

  test('un type de demande inconnu est refusé', async ({ client }) => {
    await post(client, { ...VALID, type: 'autre' })

    fakeMailer.mails.assertNoneSent()
  })

  test('?type=partnership présélectionne le partenariat, partenariat reste accepté', async ({
    client,
    assert,
  }) => {
    const plain = await client.get('/fr/contact').withInertia()
    const partner = await client.get('/fr/contact?type=partnership').withInertia()
    const legacy = await client.get('/fr/contact?type=partenariat').withInertia()

    assert.equal(plain.inertiaProps.initialType, 'contact')
    assert.equal(partner.inertiaProps.initialType, 'partnership')
    assert.equal(legacy.inertiaProps.initialType, 'partnership')
  })

  test("l'envoi est limité par IP", async ({ client, assert }) => {
    for (let attempt = 0; attempt < CONTACT_REQUEST_LIMIT.requests; attempt++) {
      await post(client, VALID)
    }

    const blocked = await post(client, VALID)

    blocked.assertStatus(302)
    assert.match(String(blocked.flashMessages().error), /^Trop de tentatives/)
    fakeMailer.mails.assertSentCount(ContactRequestNotification, CONTACT_REQUEST_LIMIT.requests)
  })
})
