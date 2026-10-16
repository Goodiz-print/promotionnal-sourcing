# Politique de traduction : langue source et traductions automatiques

> Date : 2026-10-16

Issue #75. Le fournisseur saisit les noms et descriptions dans sa langue source ;
les autres langues de contenu sont générées automatiquement, marquées « auto » et
corrigeables.

- **Migration** `…1792200000000_add_translation_source_and_auto_flag` (avec `down()`) :
  `source_locale` (défaut `fr`) sur `products`, `categories`, `attributes`,
  `attribute_values` ; `is_auto` (défaut `false`) sur les quatre tables
  `*_translations` du catalogue. `database/schema.ts` régénéré.
- **Validateurs** : `createSupplierProductValidator` / `updateSupplierProductValidator`
  (et équivalents catégories). `create` : `sourceLocale` obligatoire, seule la
  traduction de cette langue est requise (sinon erreur de validation sur
  `translations.<locale>.name`). `update` : partiel, une seule langue modifiable
  sans renvoyer le produit ; facettes conservées si `attributeValueIds` est absent.
- **Sauvegarde** (`SupplierProductService`, `CategoryService`) : les textes saisis
  sont écrits avec `is_auto = false` (une ligne inchangée garde son marquage) puis
  `TranslationQueueService` dispatche `TranslateEntityJob`. Un échec de queue est
  loggé sans faire échouer la sauvegarde.
- **`TranslationService`** : écrit `is_auto = true` et n'écrase jamais une ligne
  `is_auto = false`.
- **Frontend** : sélecteur de langue source, badges « Source » / « Auto » dans le
  formulaire produit ; seules les langues renseignées et modifiées sont envoyées.
- **Tests** : `tests/functional/translation_policy.spec.ts`.
- **Non couvert** : les 32 langues et la recherche dans la locale de l'utilisateur
  (#84), le chiffrage Mistral, le déclenchement pour attributs et valeurs d'attributs
  (pas d'écran d'écriture), mise à jour du `search_vector`.
