import vine from '@vinejs/vine'

const DATE_OPTIONS = { formats: ['YYYY-MM-DD'] }

/**
 * Période d'un écran de monitoring (query string), `from` et `to` optionnels.
 * Dates réelles du calendrier ; l'ordre `from` ≤ `to` est vérifié par le
 * contrôleur (`afterOrEqual` plante si `from` manque).
 */
export const adminPeriodValidator = vine.create({
  from: vine.date(DATE_OPTIONS).optional(),
  to: vine.date(DATE_OPTIONS).optional(),
})
