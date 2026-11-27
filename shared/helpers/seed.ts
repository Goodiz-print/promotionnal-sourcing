/** Mot de passe des comptes de démo hors production (dev, tests). */
export const DEV_DEMO_PASSWORD = 'password'

/** Longueur minimale du mot de passe des comptes de démo en production (staging). */
export const MIN_DEMO_PASSWORD_LENGTH = 12

/**
 * Mot de passe des comptes de démo et de test. Hors production : la valeur
 * configurée, sinon `password`. En production (le staging tourne avec
 * `NODE_ENV=production`), seulement une valeur configurée assez longue, sinon
 * `null` : l'appelant refuse alors de créer un admin « password » sur une URL
 * publique.
 */
export function resolveDemoPassword(
  configured: string | undefined,
  inProduction: boolean
): string | null {
  const value = configured?.trim() ?? ''
  if (!inProduction) return value || DEV_DEMO_PASSWORD
  return value.length >= MIN_DEMO_PASSWORD_LENGTH ? value : null
}
