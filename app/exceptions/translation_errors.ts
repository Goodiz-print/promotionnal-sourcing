import { errors } from '@vinejs/vine'
import type { ContentLocale } from '#shared/types/i18n'

/**
 * La traduction de la langue source (`sourceLocale`) est obligatoire : c'est
 * le texte saisi par le fournisseur, point de départ des traductions
 * automatiques. Erreur de validation (422) rattachée au champ concerné, rendue
 * comme les autres erreurs de formulaire Inertia.
 */
export function missingSourceTranslation(sourceLocale: ContentLocale) {
  return new errors.E_VALIDATION_ERROR([
    {
      field: `translations.${sourceLocale}.name`,
      message: 'The source language translation is required',
      rule: 'required',
    },
  ])
}
