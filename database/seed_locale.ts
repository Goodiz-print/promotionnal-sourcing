import type { ContentLocale } from '#shared/types/i18n'

/**
 * Langues dans lesquelles les données de démonstration (seeders) sont rédigées.
 * Hors de `database/seeders/` : le runner exécute chaque fichier de ce dossier.
 */
export type SeedLocale = Extract<ContentLocale, 'fr' | 'en'>
