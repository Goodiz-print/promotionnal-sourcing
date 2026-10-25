import { Exception } from '@adonisjs/core/exceptions'

/**
 * Une tâche Meilisearch s'est terminée en échec (`failed`) ou n'a pas abouti
 * dans le délai imparti. Le job qui l'a lancée est rejoué (la synchronisation
 * est idempotente).
 */
export class SearchTaskFailedException extends Exception {
  static status = 502
  static code = 'E_SEARCH_TASK_FAILED'
  static message = 'The search engine could not complete the indexing task'
}
