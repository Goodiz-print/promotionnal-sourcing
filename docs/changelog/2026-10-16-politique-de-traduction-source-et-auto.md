# Politique de traduction : langue source, saisie manuelle et traduction par lot

> Date : 2026-10-16

Issue #75. Le fournisseur saisit les noms et descriptions dans sa langue source ;
les autres langues de contenu sont générées automatiquement en un seul appel IA,
marquées « auto » et corrigeables.

- **Migration** `…1792200000000_add_translation_source_and_auto_flag` (avec `down()`) :
  `source_locale` (défaut `fr`) sur `products`, `categories`, `attributes`,
  `attribute_values` ; `is_auto` (défaut `false`) sur les quatre tables
  `*_translations` du catalogue. `database/schema.ts` régénéré.
- **Validateurs** : `createSupplierProductValidator` / `updateSupplierProductValidator`
  (et équivalents catégories). `create` : `sourceLocale` obligatoire, seule la
  traduction de cette langue est requise (sinon `MissingSourceContentException`, 422).
  `update` : partiel, une seule langue modifiable sans renvoyer le produit ;
  facettes conservées si `attributeValueIds` est absent. Les clés de `translations`
  restent `fr` et `en` : la saisie fournisseur n'expose pas encore les autres langues.
- **Sauvegarde** (`SupplierProductService`, `CategoryService`) : les textes saisis
  sont écrits avec `is_auto = false` (une ligne inchangée garde son marquage).
  `TranslationQueueService` dispatche `TranslateEntityJob` vers toutes les langues
  de `TRANSLATION_LOCALES` sauf la source. Pour un produit, seulement s'il est
  publié (`isActive`). Un échec de queue est loggé sans faire échouer la sauvegarde.
- **Traduction par lot** : un seul appel IA par entité, qui renvoie toutes les
  langues cibles. Une langue déjà à jour (même clé d'idempotence) n'entre pas dans
  l'appel. Les lignes générées portent `is_auto = true`.
- **`TranslationService`** : n'écrase jamais une ligne `is_auto = false` ; rafraîchit
  `search_vector` après chaque traduction de produit.
- **Frontend** : sélecteur de langue source, badges « Source » / « Auto » dans le
  formulaire produit ; seules les langues renseignées et modifiées sont envoyées.
  La création envoie `sourceLocale`.
- **Tests** : `tests/functional/translation_policy.spec.ts` et
  `tests/functional/ai_idempotency.spec.ts`.
- **Non couvert** : les 32 langues en saisie et la recherche dans la locale de
  l'utilisateur (#84), le chiffrage Mistral et la mesure sur 1 000 produits,
  la traduction rétroactive des produits existants, le déclenchement pour attributs
  et valeurs d'attributs (pas encore d'écran d'écriture, #48).
