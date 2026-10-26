# Produit : logistique / conditionnement (ÉTAPE 4)

> Date : 2026-10-26

ÉTAPE 4 du plan d'extension du modèle produit (`docs/product-model-extension-plan.md`,
« Séquencement conseillé » point 4 — écart 3, Logistique / conditionnement).
Ajoute un bloc de conditionnement **1:1** par produit (table dédiée pour garder
`products` léger). Données rarement filtrées → colonnes simples (pas d'EAV) et
**aucune facette Meilisearch** (le mapping d'index n'est pas touché). Aucun
changement au marquage structuré (écart 2), traité ultérieurement.

## Base de données (migration avec `down()`)

- **`product_packagings`** (nouvelle table 1:1) : `product_id` (**FK unique** vers
  `products`, `onDelete CASCADE`), `package_type` (string null — champ libre :
  Polybag / Boîte cadeau / Étui / Tube / Vrac / Blister…), `unit_gross_weight_g`
  (int null), `inner_carton_qty` (int null), `outer_carton_qty` (int null),
  `outer_carton_length_mm` / `outer_carton_width_mm` / `outer_carton_height_mm`
  (int null), `outer_carton_gross_weight_g` (int null), `outer_carton_volume_m3`
  (decimal null), timestamps. `schema.ts` régénéré par `migration:run`.

## Modèle & relation

- `ProductPackaging` (`app/models/product_packaging.ts`) étend le schema généré ;
  `belongsTo(Product)`. Le décimal `outer_carton_volume_m3` est sérialisé en
  chaîne par Lucid, comme les autres colonnes decimal du projet.
- `Product.hasOne(ProductPackaging)` (relation `packaging`).

## Types (`shared/types/product.ts`)

- `ProductPackagingType` (sérialisé frontend ; `outerCartonVolumeM3` en chaîne),
  intégré à `ProductDetailType.packaging` et `ProductEditType.packaging`
  (`null` si non renseigné).
- `ProductPackagingInput` (tous champs optionnels) intégré à
  `SupplierProductInput` / `SupplierProductUpdateInput` : **`packaging` absent =
  inchangé** ; fourni = upsert complet du bloc (champs absents remis à `null`).

## Validation (VineJS, `app/validators/supplier_product.ts`)

- Nœud `packaging` optionnel sur la création **et** la mise à jour : `package_type`
  (string ≤ 120), poids / quantités / dimensions = **entiers positifs** optionnels
  nullables, `outer_carton_volume_m3` = **décimal positif** optionnel nullable.

## Service (`app/services/supplier_product_service.ts`)

- `syncPackaging()` : upsert 1:1 (`updateOrCreate` sur `product_id`) exécuté
  **dans la même transaction** que le save produit, en création comme en mise à
  jour. `packaging` absent = non touché.
- `findOwned()` et `ProductCatalogueService.findBySlug()` préchargent `packaging`.

## Transformer & frontend

- `ProductPackagingTransformer` ; branché dans `ProductDetailTransformer` et
  `ProductEditTransformer`.
- Formulaire fournisseur : section « Conditionnement / logistique »
  (`inertia/components/products/form/product_packaging_fields.vue`, composants
  `base_*`, i18n `t()`, soumission Inertia existante). `base_input` accepte
  désormais une prop `step` (champ volume décimal).
- Fiche produit publique (`inertia/pages/products/show.vue`) : section
  « Conditionnement » listant les champs renseignés (dimensions carton maître
  regroupées en « L × l × H »).

## Données de référence

- Produit de démo complet « casquette-6-panneaux-marine » : bloc conditionnement
  renseigné (`database/seeders/product_seeder.ts`).
- Factory `ProductPackagingFactory` (`database/factories/product_packaging_factory.ts`).

## Tests

- `tests/functional/product_logistics.spec.ts` (PostgreSQL) : création (upsert
  crée l'unique ligne), mise à jour (upsert sans doublon), « absent = inchangé »,
  sérialisation du décimal en chaîne sur la fiche publique, cascade de suppression,
  factory.

## i18n

- `resources/lang/{fr,en}/products.json` : libellés des champs, titres de section
  (formulaire + fiche), placeholder du type de conditionnement.
