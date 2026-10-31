import { test } from '@japa/runner'
import { compactSearchFilters, normalizeSearchTerm } from '#shared/helpers/search_event'
import { SEARCH_EVENT_TERM_MAX_LENGTH } from '#shared/types/search_event'

test.group('Journal des recherches — helpers', () => {
  test('le terme est normalisé : espaces écrasés, minuscules', ({ assert }) => {
    assert.equal(normalizeSearchTerm('  Stylo   BLEU \n'), 'stylo bleu')
  })

  test('un terme vide ou absent devient null', ({ assert }) => {
    assert.isNull(normalizeSearchTerm('   '))
    assert.isNull(normalizeSearchTerm(null))
    assert.isNull(normalizeSearchTerm(undefined))
  })

  test('un terme trop long est tronqué', ({ assert }) => {
    const term = normalizeSearchTerm('a'.repeat(SEARCH_EVENT_TERM_MAX_LENGTH + 50))
    assert.lengthOf(term!, SEARCH_EVENT_TERM_MAX_LENGTH)
  })

  test('seuls les filtres actifs sont conservés', ({ assert }) => {
    assert.deepEqual(
      compactSearchFilters({
        madeInEurope: true,
        newOnly: false,
        country: '',
        certificationIds: [3, 4],
        stockStatuses: [],
        priceBuckets: null,
        attributeRanges: 0,
      }),
      { madeInEurope: true, certificationIds: [3, 4], attributeRanges: 0 }
    )
  })
})
