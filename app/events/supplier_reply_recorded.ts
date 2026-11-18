import type { SupplierReplyRecordedData } from '#shared/types/supplier_reply'

/**
 * La réponse d'un fournisseur reçue par mail vient d'être enregistrée dans le
 * fil de la demande (#224). Émis une seule fois par mail, après le commit.
 * Point d'accroche de la transmission à l'agence (#225).
 */
export default class SupplierReplyRecorded {
  constructor(public reply: SupplierReplyRecordedData) {}
}
