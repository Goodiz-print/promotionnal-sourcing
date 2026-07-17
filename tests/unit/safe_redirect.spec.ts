import { test } from '@japa/runner'
import { isSafeRedirectPath } from '#shared/helpers/safe_redirect'

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
