import vine from '@vinejs/vine'
import { DELIVERY_SCOPES } from '#shared/types/organization'

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
})
