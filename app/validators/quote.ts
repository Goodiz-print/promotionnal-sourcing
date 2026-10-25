import vine from '@vinejs/vine'

/**
 * Ligne de devis (fabrique : un nœud VineJS neuf par appel). Les totaux ne
 * sont **pas** des champs : `QuoteService` les calcule, un montant envoyé par
 * le client n'est jamais cru.
 */
const quoteItem = () =>
  vine.object({
    rfqItemId: vine.number().positive(),
    unitPrice: vine.number().positive().max(9_999_999),
    quantity: vine.number().positive().withoutDecimals().max(100_000_000),
    leadTimeDays: vine.number().min(0).withoutDecimals().max(730),
    customizationDetails: vine.record(vine.string().maxLength(255)).optional().nullable(),
  })

/**
 * Formulaire de devis (création **et** mise à jour d'un brouillon).
 * `validUntil` est une date `AAAA-MM-JJ` (`<input type="date">`) ; son rapport à
 * aujourd'hui est vérifié par le service.
 */
export const quoteValidator = vine.create({
  validUntil: vine
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  notes: vine.string().maxLength(5000).trim().optional().nullable(),
  items: vine.array(quoteItem()).minLength(1).maxLength(50),
})
