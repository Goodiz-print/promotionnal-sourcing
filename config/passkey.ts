import env from '#start/env'

const appUrl = new URL(env.get('APP_URL', 'http://localhost:5555'))

/**
 * Configuration WebAuthn (passkeys). Le `rpID` est le domaine auquel les
 * passkeys sont liées : le modifier invalide toutes celles déjà enregistrées.
 */
const passkeyConfig = {
  rpName: env.get('APP_NAME', 'Promotionnal Sourcing'),
  rpID: env.get('PASSKEY_RP_ID', appUrl.hostname),
  origin: env.get('PASSKEY_ORIGIN', appUrl.origin),
}

export default passkeyConfig
