import factory from '@adonisjs/lucid/factories'
import SearchEvent from '#models/search_event'

export const SearchEventFactory = factory
  .define(SearchEvent, ({ faker }) => ({
    source: 'catalogue' as const,
    term: faker.commerce.product().toLowerCase(),
    filters: {},
    mode: 'keywords' as const,
    resultsCount: faker.number.int({ min: 0, max: 40 }),
    locale: 'fr',
  }))
  .build()
