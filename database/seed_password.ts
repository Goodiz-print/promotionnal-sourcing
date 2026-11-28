import app from '@adonisjs/core/services/app'
import env from '#start/env'
import { resolveDemoPassword } from '#shared/helpers/seed'
import { DemoPasswordMissingException } from '#exceptions/seed_errors'

/**
 * Mot de passe commun des comptes de démo et de test (`SEED_DEMO_PASSWORD`).
 * La règle vit dans `resolveDemoPassword` ; ce module ne fait que lire
 * l'environnement et lever l'erreur, d'où sa place hors de `shared/helpers`.
 * Hors de `database/seeders/` : le runner exécute chaque fichier de ce dossier.
 */
export function demoPassword(): string {
  const password = resolveDemoPassword(env.get('SEED_DEMO_PASSWORD')?.release(), app.inProduction)
  if (password === null) throw new DemoPasswordMissingException()
  return password
}
