import { test } from '@japa/runner'
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
