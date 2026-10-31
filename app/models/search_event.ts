import { SearchEventSchema } from '#database/schema'
import type {
  SearchEventFilters,
  SearchEventMode,
  SearchEventSource,
} from '#shared/types/search_event'

/**
 * Une recherche d'un client (#171). En ajout seul : aucune colonne `updated_at` ;
 * `SearchEventService` n'expose que l'écriture, la pseudonymisation et la purge.
 */
export default class SearchEvent extends SearchEventSchema {
  static table = 'search_events'

  declare source: SearchEventSource
  declare mode: SearchEventMode
  declare filters: SearchEventFilters
}
