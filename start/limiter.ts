/*
|--------------------------------------------------------------------------
| Limiteurs HTTP
|--------------------------------------------------------------------------
|
| Limites de débit sur les écrans d'authentification (force brute, création de
| comptes en masse, spam de mails). Chaque limiteur est un middleware appliqué
| route par route dans `start/routes.ts`.
|
| Un dépassement lève `E_TOO_MANY_REQUESTS`, que `HttpExceptionHandler`
| convertit en redirection `back()` + message flash `auth.throttled` pour les
| écrans Inertia (429 JSON pour les clients API).
|
*/

import limiter from '@adonisjs/limiter/services/main'
import type { HttpContext } from '@adonisjs/core/http'

/** Paramètres des limiteurs, partagés avec les tests et la remise à zéro du login. */
export const LOGIN_LIMIT = { requests: 5, duration: '15 mins' } as const
export const SIGNUP_LIMIT = { requests: 10, duration: '1 hour' } as const
export const PASSWORD_RESET_LIMIT = { requests: 5, duration: '1 hour' } as const
export const EMAIL_VERIFICATION_RESEND_LIMIT = { requests: 5, duration: '1 hour' } as const

const normalizeEmail = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

/**
 * Clé du limiteur de login : IP **et** email. Un attaquant ne peut ainsi pas
 * verrouiller le compte d'un tiers depuis n'importe où, ni essayer des milliers
 * d'emails depuis une seule IP sans être compté pour chacun.
 */
const loginKey = ({ request }: HttpContext) =>
  `ip_${request.ip()}_email_${normalizeEmail(request.input('email'))}`

export const loginThrottle = limiter.define('login', (ctx) =>
  limiter.allowRequests(LOGIN_LIMIT.requests).every(LOGIN_LIMIT.duration).usingKey(loginKey(ctx))
)

/**
 * Un login réussi remet le compteur à zéro : seuls les échecs consécutifs
 * doivent compter, pas les connexions légitimes d'un utilisateur qui se
 * reconnecte plusieurs fois.
 */
export async function clearLoginThrottle(ctx: HttpContext): Promise<void> {
  await limiter
    .use({ requests: LOGIN_LIMIT.requests, duration: LOGIN_LIMIT.duration })
    .delete(`login_${loginKey(ctx)}`)
}

export const signupThrottle = limiter.define('signup', ({ request }) =>
  limiter
    .allowRequests(SIGNUP_LIMIT.requests)
    .every(SIGNUP_LIMIT.duration)
    .usingKey(`ip_${request.ip()}`)
)

/** Par email : empêche de spammer la boîte d'un tiers depuis plusieurs IP. */
export const passwordResetThrottle = limiter.define('password-reset', ({ request }) =>
  limiter
    .allowRequests(PASSWORD_RESET_LIMIT.requests)
    .every(PASSWORD_RESET_LIMIT.duration)
    .usingKey(`email_${normalizeEmail(request.input('email'))}`)
)

/** Route authentifiée : par compte (repli sur l'IP si la session a expiré). */
export const emailVerificationResendThrottle = limiter.define(
  'email-verification-resend',
  ({ auth, request }) =>
    limiter
      .allowRequests(EMAIL_VERIFICATION_RESEND_LIMIT.requests)
      .every(EMAIL_VERIFICATION_RESEND_LIMIT.duration)
      .usingKey(auth.user ? `user_${auth.user.id}` : `ip_${request.ip()}`)
)
