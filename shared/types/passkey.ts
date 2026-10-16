import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server'

/** Durée de validité d'un défi WebAuthn (cérémonie d'enregistrement ou de connexion). */
export const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000

export const PASSKEY_NAME_MAX_LENGTH = 100

/** Défi émis par le serveur, conservé en session jusqu'à la réponse de l'authentificateur. */
export interface PasskeyChallenge {
  value: string
  expiresAt: number
}

/**
 * Passkey telle qu'affichée sur la page « mon compte » : jamais la clé publique
 * ni l'identifiant WebAuthn. Défini en `type` (DTO de page Inertia, cf. `AccountType`).
 */
export type PasskeyType = {
  id: number
  name: string
  deviceType: 'singleDevice' | 'multiDevice'
  backedUp: boolean
  createdAt: string
  lastUsedAt: string | null
}

export interface RegisterPasskeyData {
  credential: RegistrationResponseJSON
  name: string
}

export type AuthenticatePasskeyData = AuthenticationResponseJSON
