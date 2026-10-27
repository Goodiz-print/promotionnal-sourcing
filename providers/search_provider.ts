import type { ApplicationService } from '@adonisjs/core/types'
import searchConfig from '#config/search'
import SearchEngine from '#services/search/search_engine'
import ElasticsearchEngine from '#services/search/elasticsearch_engine'
import NullSearchEngine from '#services/search/null_search_engine'

/**
 * Lie l'abstraction `SearchEngine` : Elasticsearch quand `ELASTICSEARCH_URL` est
 * défini (ADR 0004), moteur
 * inerte sinon (dev, test, CI). Singleton : le client HTTP et la garantie de l'index
 * ne sont initialisés qu'une fois ; le client n'est créé qu'à la première
 * utilisation, donc sans effet quand la recherche est désactivée.
 */
export default class SearchProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(SearchEngine, async (resolver) => {
      switch (searchConfig.engine) {
        case 'elasticsearch':
          return resolver.make(ElasticsearchEngine)
        default:
          return resolver.make(NullSearchEngine)
      }
    })
  }
}
