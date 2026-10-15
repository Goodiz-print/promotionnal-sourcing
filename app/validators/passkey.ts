import vine from '@vinejs/vine'
import { PASSKEY_NAME_MAX_LENGTH } from '#shared/types/passkey'

/**
 * `credential` : réponse de l'authentificateur sérialisée en JSON (le navigateur
 * produit un objet que `@simplewebauthn/server` valide lui-même en profondeur).
 */
const credential = vine.string().maxLength(20_000)

export const registerPasskeyValidator = vine.create({
  credential,
  name: vine.string().trim().minLength(1).maxLength(PASSKEY_NAME_MAX_LENGTH),
})

export const renamePasskeyValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(PASSKEY_NAME_MAX_LENGTH),
})

export const authenticatePasskeyValidator = vine.create({ credential })
