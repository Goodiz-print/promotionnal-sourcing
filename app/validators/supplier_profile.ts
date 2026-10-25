import vine from '@vinejs/vine'
import {
  CATALOGUE_UPDATE_FREQUENCIES,
  CATALOGUE_UPDATE_MODES,
  DELIVERY_SCOPES,
  REPORT_FREQUENCIES,
  SUPPLIER_COMPANY_TYPES,
} from '#shared/types/organization'

/**
 * Validation de la mise à jour du profil fournisseur (upsert). Tous les
 * champs sont optionnels : l'écran envoie l'ensemble du formulaire, mais un
 * fournisseur peut ne renseigner qu'une partie de son profil.
 */
export const updateSupplierProfileValidator = vine.create({
  minOrderQuantity: vine.number().min(0).max(1_000_000).optional().nullable(),
  deliveryDays: vine.number().min(0).max(3650).optional().nullable(),
  deliveryScope: vine.enum(DELIVERY_SCOPES).optional().nullable(),
  certifications: vine.array(vine.string().trim().maxLength(100)).optional().nullable(),
  bio: vine.string().trim().maxLength(2000).optional().nullable(),
  responseTimeDays: vine.number().min(0).max(365).optional().nullable(),
  companyType: vine.enum(SUPPLIER_COMPANY_TYPES).optional().nullable(),
  deliveryCountries: vine.array(vine.string().trim().fixedLength(2)).optional().nullable(),
  spokenLanguages: vine.array(vine.string().trim().minLength(2).maxLength(5)).optional().nullable(),
  minOrderNote: vine.string().trim().maxLength(255).optional().nullable(),
  quoteEmail: vine.string().trim().email().maxLength(254).optional().nullable(),
  reportFrequency: vine.enum(REPORT_FREQUENCIES).optional(),
  catalogueUpdateMode: vine.enum(CATALOGUE_UPDATE_MODES).optional().nullable(),
  catalogueUpdateFrequency: vine.enum(CATALOGUE_UPDATE_FREQUENCIES).optional().nullable(),
})
