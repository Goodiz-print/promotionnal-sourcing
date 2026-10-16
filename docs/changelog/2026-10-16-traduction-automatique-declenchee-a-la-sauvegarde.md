# Traduction automatique déclenchée à la sauvegarde

> Date : 2026-10-16

`TranslateEntityJob` est désormais branché (#75, premier volet).

- **Déclenchement** — `TranslationDispatcher` (`app/services/translation_dispatcher.ts`) met le job
  en queue vers toutes les langues de contenu autres que la source (`fr` par défaut). Appelé par
  `SupplierProductService` (création / mise à jour, **produits publiés uniquement**) et
  `CategoryService` (création / mise à jour). Un échec de queue est loggé, jamais propagé. Le job
  reste un no-op tant que `AI_TRANSLATION_ENABLED` est faux.
- **Marquage « auto »** — migration `1792300000000_add_is_auto_to_translations` : colonne
  `is_auto` (défaut `false`) sur les 4 tables de traduction. `TranslationService` écrit
  `is_auto = true` et **n'écrase jamais** une ligne `is_auto = false` (saisie ou corrigée à la main).
  Les écritures des formulaires produit et catégorie posent `is_auto = false`.
- **Tests** — `tests/functional/ai_idempotency.spec.ts` (protection des saisies manuelles, marquage,
  cibles du dispatcher).
- **Reste à faire pour #75** — `sourceLocale` persisté, validateurs `create`/`update` partiels (le
  formulaire exige encore `fr` et `en`, donc rien n'est auto-traduit tant que les deux sont saisis),
  attributs et valeurs d'attributs (pas de point de sauvegarde applicatif aujourd'hui), passage aux
  32 langues.
