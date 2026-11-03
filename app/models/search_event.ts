import { SearchEventSchema } from '#database/schema'
import type {
  SearchEventFilters,
  SearchEventMode,
  SearchEventSource,
} from '#shared/types/search_event'

/**
 * Une recherche d'un client. En ajout seul : seule la pseudonymisation
 * (`user_id` → `NULL`) et la purge planifiée modifient ou suppriment des lignes,
 * en SQL direct (`SearchEventService`).
 */
export default class SearchEvent extends SearchEventSchema {
  static table = 'search_events'

  declare source: SearchEventSource
  declare mode: SearchEventMode
  declare filters: SearchEventFilters
}
