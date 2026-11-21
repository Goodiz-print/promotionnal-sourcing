/**
 * Ce qu'il faut apposer sur le devis PDF d'un fournisseur non abonné pour
 * l'agence destinataire (#238) : le fournisseur ne connaît pas l'agence (#220),
 * son PDF n'en porte donc pas le nom.
 */
export interface RecipientStampOptions {
  /** Nom de société de l'agence destinataire. */
  agencyName: string
  /** Référence de la demande de devis, telle que l'agence la connaît. */
  rfqRef: string
  /** Identifiants joints aux warnings de repli, pour les retrouver (#227). */
  logContext?: Record<string, number>
}

/** Raison pour laquelle un devis est transmis sans mention (repli). */
export type RecipientStampRefusal = 'signed' | 'unencodable'

/** Hauteur du bandeau ajouté en tête de la première page, en points PDF. */
export const RECIPIENT_BANNER_HEIGHT = 28

/** Côté maximal d'une page PDF (limite d'Acrobat), en points. */
export const PDF_MAX_PAGE_SIZE = 14_400
