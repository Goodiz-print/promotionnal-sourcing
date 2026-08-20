import { SUPPORTED_LOCALES } from '../types/i18n.js'

const SAFE_REDIRECT_PATTERN = new RegExp(`^/(${SUPPORTED_LOCALES.join('|')})(/|$)`)

/**
 * Vérifie qu'un paramètre `redirect` (query string, ex. après signup/login)
 * est un chemin interne sûr : préfixé `/<locale>`, jamais une URL absolue ou
 * protocole-relative (`//host/...`) — évite l'open redirect tout en
 * permettant de ramener l'utilisateur sur la page qu'il visitait (ex. accepter
 * une invitation après authentification).
 */
export function isSafeRedirectPath(path: unknown): path is string {
  return typeof path === 'string' && SAFE_REDIRECT_PATTERN.test(path)
}
