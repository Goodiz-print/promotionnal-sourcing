import { describe, it, expect, vi } from 'vitest'

vi.mock('@inertiajs/vue3', () => ({
  usePage: () => ({
    props: {
      locale: 'fr',
      supportedLocales: ['fr', 'en'],
      translations: {
        'common.nav.login': 'Connexion',
        'common.greeting': 'Bonjour {name}',
        'cart.items':
          'Vous avez {count, plural, =0 {aucun article} one {# article} other {# articles}}',
      },
    },
  }),
}))

const { translate, useI18n } = await import('~/i18n')

describe('translate', () => {
  it('renvoie la clé quand la traduction est absente', () => {
    expect(translate({}, 'fr', 'missing.key')).toBe('missing.key')
  })

  it('renvoie le message brut sans placeholder ICU', () => {
    expect(translate({ 'a.b': 'Bonjour' }, 'fr', 'a.b')).toBe('Bonjour')
  })

  it('interpole les variables ICU', () => {
    expect(translate({ 'a.b': 'Bonjour {name}' }, 'fr', 'a.b', { name: 'Malo' })).toBe(
      'Bonjour Malo'
    )
  })

  it('gère les pluriels ICU', () => {
    const messages = {
      items: 'Vous avez {count, plural, =0 {aucun article} one {# article} other {# articles}}',
    }
    expect(translate(messages, 'fr', 'items', { count: 0 })).toBe('Vous avez aucun article')
    expect(translate(messages, 'fr', 'items', { count: 3 })).toBe('Vous avez 3 articles')
  })
})

describe('useI18n', () => {
  it('expose la locale active et un t() branché sur les props partagées', () => {
    const { t, locale } = useI18n()
    expect(locale.value).toBe('fr')
    expect(t('common.nav.login')).toBe('Connexion')
    expect(t('common.greeting', { name: 'Malo' })).toBe('Bonjour Malo')
  })
})
