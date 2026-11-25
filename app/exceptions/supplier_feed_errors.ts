import { Exception } from '@adonisjs/core/exceptions'

/** Le connecteur n'a pas ses identifiants (variables d'environnement absentes). */
export class SupplierConnectorNotConfiguredException extends Exception {
  static status = 500
  static code = 'E_SUPPLIER_CONNECTOR_NOT_CONFIGURED'
}

/** Réponse HTTP en erreur ou illisible d'un flux fournisseur. L'URL est toujours masquée. */
export class SupplierFeedHttpException extends Exception {
  static status = 502
  static code = 'E_SUPPLIER_FEED_HTTP'
}

/**
 * Catalogue ou flux annexe incomplet sur un import intégral : rien n'est écrit,
 * pour ne pas écraser ni désactiver des données existantes.
 */
export class SupplierFeedIncompleteException extends Exception {
  static status = 502
  static code = 'E_SUPPLIER_FEED_INCOMPLETE'
}

/** Clé de connecteur inconnue. */
export class UnknownSupplierConnectorException extends Exception {
  static status = 400
  static code = 'E_UNKNOWN_SUPPLIER_CONNECTOR'
}
