import { test } from '@japa/runner'
import { isSafeRedirectPath, loginPathFor } from '#shared/helpers/safe_redirect'

test.group('isSafeRedirectPath', () => {
  test('accepte un chemin préfixé par une locale supportée', ({ assert }) => {
    assert.isTrue(isSafeRedirectPath('/fr/organization/invitations/1/accept'))
    assert.isTrue(isSafeRedirectPath('/en'))
    assert.isTrue(isSafeRedirectPath('/fr/organization/settings?foo=bar'))
  })

  test('rejette une URL absolue ou protocole-relative', ({ assert }) => {
    assert.isFalse(isSafeRedirectPath('https://evil.example.com/fr'))
    assert.isFalse(isSafeRedirectPath('//evil.example.com/fr'))
  })

  test('rejette un chemin sans préfixe de locale supportée', ({ assert }) => {
    assert.isFalse(isSafeRedirectPath('/xx/organization/settings'))
    assert.isFalse(isSafeRedirectPath('organization/settings'))
    assert.isFalse(isSafeRedirectPath(''))
  })

  test('rejette les valeurs non-string', ({ assert }) => {
    assert.isFalse(isSafeRedirectPath(null))
    assert.isFalse(isSafeRedirectPath(undefined))
    assert.isFalse(isSafeRedirectPath(42))
  })
})

test.group('loginPathFor', () => {
  test('une navigation GET revient à la page demandée, query string comprise', ({ assert }) => {
    assert.equal(
      loginPathFor({
        locale: 'fr',
        method: 'GET',
        path: '/fr/quote-documents/7/download?x=1',
        isNavigation: true,
      }),
      '/fr/login?redirect=%2Ffr%2Fquote-documents%2F7%2Fdownload%3Fx%3D1'
    )
  })

  test('la page de connexion est dans la langue de la requête', ({ assert }) => {
    assert.equal(
      loginPathFor({ locale: 'en', method: 'get', path: '/en/rfqs', isNavigation: true }),
      '/en/login?redirect=%2Fen%2Frfqs'
    )
  })

  test('un POST ou un chemin non sûr mène à la connexion, sans redirect', ({ assert }) => {
    assert.equal(
      loginPathFor({ locale: 'fr', method: 'POST', path: '/fr/rfqs', isNavigation: true }),
      '/fr/login'
    )
    assert.equal(
      loginPathFor({
        locale: 'fr',
        method: 'GET',
        path: '//evil.example.com/fr',
        isNavigation: true,
      }),
      '/fr/login'
    )
  })

  test('un appel qui attend du JSON mène à la connexion, sans redirect', ({ assert }) => {
    assert.equal(
      loginPathFor({ locale: 'fr', method: 'GET', path: '/fr/rfqs', isNavigation: false }),
      '/fr/login'
    )
  })
})
