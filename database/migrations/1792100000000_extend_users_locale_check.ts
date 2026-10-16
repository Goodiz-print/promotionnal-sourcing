import { BaseSchema } from '@adonisjs/lucid/schema'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '#shared/types/i18n'

/**
 * Étend la contrainte CHECK de `users.locale` aux nouvelles langues d'interface
 * (de, es, it, nl, pt, pl, sv). La migration d'origine posait la liste en dur
 * (fr, en) ; elle n'est pas modifiée car déjà exécutée en production.
 */
const PREVIOUS_LOCALES = ['fr', 'en']

const quoted = (locales: readonly string[]) => locales.map((locale) => `'${locale}'`).join(', ')

export default class extends BaseSchema {
  async up() {
    this.schema.raw('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_locale_check')
    this.schema.raw(
      `ALTER TABLE users ADD CONSTRAINT users_locale_check CHECK (locale IN (${quoted(SUPPORTED_LOCALES)}))`
    )
  }

  async down() {
    // Les comptes qui ont choisi une langue retirée repassent sur la langue par défaut.
    this.schema.raw(
      `UPDATE users SET locale = '${DEFAULT_LOCALE}' WHERE locale NOT IN (${quoted(PREVIOUS_LOCALES)})`
    )
    this.schema.raw('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_locale_check')
    this.schema.raw(
      `ALTER TABLE users ADD CONSTRAINT users_locale_check CHECK (locale IN (${quoted(PREVIOUS_LOCALES)}))`
    )
  }
}
