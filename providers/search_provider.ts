import type { ApplicationService } from '@adonisjs/core/types'
import searchConfig from '#config/search'
import SearchEngine from '#services/search/search_engine'
import MeilisearchEngine from '#services/search/meilisearch_engine'
import NullSearchEngine from '#services/search/null_search_engine'

/**
 * Lie l'abstraction `SearchEngine` : Meilisearch quand `MEILISEARCH_HOST` est
 * défini, moteur inerte sinon (dev, test, CI). Singleton : le client HTTP et la
 * garantie de l'index ne sont initialisés qu'une fois ; le client n'est créé qu'à
 * la première écriture, donc sans effet quand la recherche est désactivée.
 */
export default class SearchProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(SearchEngine, async (resolver) => {
      return resolver.make(searchConfig.enabled ? MeilisearchEngine : NullSearchEngine)
    })
  }
}
