import type { LoginRedirectSource } from '../types/auth.js'
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

/**
 * Page de connexion d'une requête refusée faute de session : localisée
 * (`/<locale>/login` — `/login` seul n'existe pas), avec `?redirect=` vers la
 * page demandée pour y revenir après la connexion (lien reçu par mail, #225).
 * Seule une navigation `GET` vers un chemin sûr est reprise : rejouer un
 * `POST` après la connexion n'aurait pas de sens, et un endpoint JSON
 * afficherait du JSON brut.
 */
export function loginPathFor({ locale, method, path, isNavigation }: LoginRedirectSource): string {
  const loginPath = `/${locale}/login`
  const isReplayable = isNavigation && method.toUpperCase() === 'GET' && isSafeRedirectPath(path)
  return isReplayable ? `${loginPath}?redirect=${encodeURIComponent(path)}` : loginPath
}
