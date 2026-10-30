import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { useVisibleContentLocales } from '~/composables/use_visible_content_locales'
import type { ContentLocale } from '#shared/types/i18n'

function setup(initial: ContentLocale = 'fr') {
  const source = ref<ContentLocale>(initial)
  const errors = ref<Record<string, string | undefined>>({})
  const state = useVisibleContentLocales(source, () => errors.value)
  return { source, errors, ...state }
}

describe('useVisibleContentLocales', () => {
  it('affiche la langue source et une autre langue', () => {
    const { visibleLocales, otherLocale } = setup('fr')
    expect(otherLocale.value).toBe('en')
    expect(visibleLocales.value).toEqual(['fr', 'en'])
  })

  it("propose le français quand la source est l'anglais, puis exclut la source de la liste", () => {
    const { otherLocale, otherLocales } = setup('en')
    expect(otherLocale.value).toBe('fr')
    expect(otherLocales.value).not.toContain('en')
  })

  it("choisit une autre langue quand la source prend la place de l'autre langue", async () => {
    const { source, otherLocale } = setup('fr')
    source.value = 'en'
    await nextTick()
    expect(otherLocale.value).toBe('fr')
  })

  it('bascule sur une langue masquée qui porte une erreur de validation', async () => {
    const { errors, otherLocale, visibleLocales } = setup('fr')
    errors.value = { 'translations.de.description': 'Trop long' }
    await nextTick()
    expect(otherLocale.value).toBe('de')
    expect(visibleLocales.value).toEqual(['fr', 'de'])
  })

  it('ignore les erreurs de la langue source et celles qui ne portent pas sur une langue', async () => {
    const { errors, otherLocale } = setup('fr')
    errors.value = {
      'translations.fr.name': 'Requis',
      'categoryId': 'Requis',
      'translations.xx.name': 'ko',
    }
    await nextTick()
    expect(otherLocale.value).toBe('en')
  })
})
