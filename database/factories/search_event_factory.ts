import factory from '@adonisjs/lucid/factories'
import SearchEvent from '#models/search_event'

export const SearchEventFactory = factory
  .define(SearchEvent, ({ faker }) => ({
    source: 'catalogue' as const,
    query: faker.commerce.productName().toLowerCase(),
    filters: {},
    categoryId: null,
    mode: 'semantic' as const,
    resultsCount: faker.number.int({ min: 0, max: 100 }),
    zeroResults: false,
    userId: null,
    organizationId: null,
    locale: 'fr',
  }))
  .state('zeroResults', (event) => {
    event.resultsCount = 0
    event.zeroResults = true
  })
  .state('withFilters', (event, { faker }) => {
    event.filters = {
      minPrice: faker.number.int({ min: 1, max: 100 }),
      certification: 'iso9001',
    }
  })
  .state('catalogue', (event) => {
    event.source = 'catalogue'
  })
  .state('suppliers', (event) => {
    event.source = 'suppliers'
  })
  .state('rfqLookup', (event) => {
    event.source = 'rfq_lookup'
  })
  .state('keyword', (event) => {
    event.mode = 'keyword'
  })
  .state('browse', (event) => {
    event.mode = 'browse'
    event.query = null
  })
  .build()
