import vine from '@vinejs/vine'

/** Réindexation : tout le catalogue, ou un seul fournisseur. */
export const adminSearchReindexValidator = vine.create({
  supplierId: vine.number().withoutDecimals().positive().optional(),
})
