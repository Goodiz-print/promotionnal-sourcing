import vine from '@vinejs/vine'
import {
  AD_MAX_CPC_CENTS,
  AD_MAX_DAILY_BUDGET_CENTS,
  AD_MAX_TOP_UP_CENTS,
  AD_MIN_CPC_CENTS,
  AD_MIN_DAILY_BUDGET_CENTS,
  AD_MIN_TOP_UP_CENTS,
} from '#shared/types/ads'

/** Montant saisi en euros (deux décimales au plus), borné en centimes. */
const euros = (minCents: number, maxCents: number) =>
  vine
    .number()
    .decimal([0, 2])
    .min(minCents / 100)
    .max(maxCents / 100)

const day = () => vine.date({ formats: ['YYYY-MM-DD'] })

const campaignFields = {
  maxCpc: euros(AD_MIN_CPC_CENTS, AD_MAX_CPC_CENTS),
  dailyBudget: euros(AD_MIN_DAILY_BUDGET_CENTS, AD_MAX_DAILY_BUDGET_CENTS),
  startsOn: day(),
  endsOn: day().optional().nullable(),
}

/**
 * Création d'une campagne. Les règles entre champs (budget ≥ enchère, fin ≥
 * début) et l'appartenance du produit sont vérifiées par `AdCampaignService`.
 */
export const adCampaignValidator = vine.create({
  productId: vine.number().withoutDecimals().positive(),
  ...campaignFields,
})

/** Modification d'une campagne : le produit ne change pas. */
export const adCampaignUpdateValidator = vine.create(campaignFields)

/** Pause ou reprise par le fournisseur. */
export const adCampaignStatusValidator = vine.create({
  status: vine.enum(['active', 'paused'] as const),
})

/** Recharge en ligne du portefeuille. */
export const adTopUpValidator = vine.create({
  amount: euros(AD_MIN_TOP_UP_CENTS, AD_MAX_TOP_UP_CENTS),
})

/** Paramètres du lien de clic signé (emplacement et prix fixé par l'enchère). */
export const adClickValidator = vine.create({
  p: vine.enum(['catalogue', 'product', 'home'] as const),
  c: vine.number().withoutDecimals().min(AD_MIN_CPC_CENTS).max(AD_MAX_CPC_CENTS),
})

/**
 * Ajustement manuel d'un portefeuille par l'équipe (back-office) : crédit ou
 * débit en euros, avec un motif obligatoire (tracé au journal d'audit).
 */
export const adminAdWalletAdjustmentValidator = vine.create({
  organizationId: vine.number().withoutDecimals().positive(),
  amount: vine
    .number()
    .decimal([0, 2])
    .min(-AD_MAX_TOP_UP_CENTS / 100)
    .max(AD_MAX_TOP_UP_CENTS / 100),
  note: vine.string().trim().minLength(3).maxLength(500),
})

export const adminAdListValidator = vine.create({
  page: vine.number().withoutDecimals().positive().optional(),
})
