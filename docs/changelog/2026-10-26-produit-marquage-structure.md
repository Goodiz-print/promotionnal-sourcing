# Produit : marquage structuré (ÉTAPE 5)

> Date : 2026-10-26

ÉTAPE 5 du plan d'extension du modèle produit (`docs/product-model-extension-plan.md`,
« Séquencement conseillé » point 5 — écart 2, Marquage structuré). Ajoute les
zones de marquage d'un produit, les techniques possibles par zone et une grille
de prix de marquage par technique et quantité, plus un référentiel fermé de
techniques (patron des certifications). La technique de marquage **n'est pas un
filtre** : donnée de fiche uniquement, **aucune facette Meilisearch** (le mapping
d'index n'est pas touché).

## Base de données (migrations avec `down()`)

- **`marking_techniques`** (référentiel fermé, ~18 canoniques) : `slug` (unique),
  `family` (string), `synonyms` (text[]), timestamps.
- **`marking_technique_translations`** : `marking_technique_id` (FK CASCADE),
  `locale`, `name`, `is_auto`, timestamps, `unique(marking_technique_id, locale)`
  (même patron que `certification_translations`).
- **`product_marking_positions`** (1..N par produit) : `product_id` (FK CASCADE),
  `name`, `max_width_mm` (int null), `max_height_mm` (int null),
  `template_document_id` (FK `product_documents`, null, `onDelete SET NULL`),
  `position` (int), timestamps.
- **`product_marking_position_techniques`** : `marking_position_id` (FK CASCADE),
  `marking_technique_id` (FK), `max_colors` (int null), `default_setup_charge`
  (decimal null), timestamps, `unique(marking_position_id, marking_technique_id)`.
- **`product_marking_price_tiers`** : `product_id` (FK CASCADE),
  `marking_technique_id` (FK), `min_quantity` (int), `unit_price` (decimal),
  `currency` (char3), timestamps, `unique(product_id, marking_technique_id, min_quantity)`.
- **`products`** : colonne `printable` (bool, défaut `false`) — le produit
  accepte-t-il un marquage ? (nombre de positions = dérivé du `count`).
- `schema.ts` régénéré par `migration:run` (rollback + re-run vérifiés).

## Modèles & relations

- `MarkingTechnique` (+ `MarkingTechniqueTranslation`), `ProductMarkingPosition`,
  `ProductMarkingPositionTechnique`, `ProductMarkingPriceTier` étendent le schema
  généré. Décimaux (`default_setup_charge`, `unit_price`) sérialisés en chaîne par
  Lucid.
- `MarkingTechnique.hasMany(translations)` ; `ProductMarkingPosition.belongsTo(Product)`,
  `.belongsTo(ProductDocument, templateDocumentId)` (relation `templateDocument`),
  `.hasMany(ProductMarkingPositionTechnique)` ; `ProductMarkingPositionTechnique.belongsTo(MarkingTechnique)` ;
  `ProductMarkingPriceTier.belongsTo(Product)` + `.belongsTo(MarkingTechnique)`.
- `Product.hasMany(ProductMarkingPosition)` (`markingPositions`) +
  `Product.hasMany(ProductMarkingPriceTier)` (`markingPriceTiers`).

## Types (`shared/types/marking.ts`, `shared/types/product.ts`)

- `MarkingTechniqueType`, `ProductMarkingPositionType` (avec ses techniques
  résolues), `ProductMarkingPositionTechniqueType`, `ProductMarkingPriceTierType`
  et les inputs correspondants.
- `SupplierProductInput` / `SupplierProductUpdateInput` : `printable?`,
  `markingPositions?` et `markingPriceTiers?` — **absent = inchangé ; tableau =
  remplace l'ensemble** (comme variantes / paliers).
- `printable` + bloc marquage résolu intégrés à `ProductDetailType` et
  `ProductEditType` ; `printable` ajouté à `ProductType`.

## Validation (VineJS, `app/validators/supplier_product.ts`)

- Positions : `name` requis, `max_width_mm` / `max_height_mm` entiers positifs
  optionnels, `template_document_id` optionnel, techniques optionnelles
  (`max_colors` 1–32, `default_setup_charge` décimal ≥ 0 optionnels).
- Grille de prix de marquage : `min_quantity > 0`, `unit_price >= 0`, technique
  référencée. `printable` booléen optionnel.

## Service (`app/services/product_marking_service.ts`)

- `ProductMarkingService` (DI) injecté dans `SupplierProductService`, appelé
  **dans la même transaction** que le save produit (création et mise à jour), en
  **remplacement d'ensemble** des positions (+ techniques en cascade) et de la
  grille de prix (même logique que variantes / paliers).
- Gardes (classe d'erreur `invalidMarkingInput`, `app/exceptions/catalogue_errors.ts`) :
  technique inconnue, technique dupliquée sur une position, palier dupliqué, et
  **`template_document_id` = document du produit de type `marking_template`**.
- `findOwned()` et `ProductCatalogueService.findBySlug()` préchargent les positions
  (techniques + libellés) et la grille de prix.

## Transformers & frontend

- `MarkingTechniqueTransformer`, `ProductMarkingPositionTransformer` (techniques
  résolues dans la locale active), `ProductMarkingPriceTierTransformer` ; branchés
  dans `ProductDetailTransformer` et `ProductEditTransformer`.
- Formulaire fournisseur : section « Marquage » (`product_marking_fields.vue`,
  `product_marking_position_row.vue`, `product_marking_price_tiers_fields.vue`) —
  drapeau personnalisable, positions (nom, dimensions max, gabarit via sélection
  d'un document de type gabarit), techniques par position (couleurs max, frais
  techniques) et grille de prix. Composants `base_*`, i18n `t()`, soumission
  Inertia existante. `markingTechniques` ajouté aux données de facettes du
  contrôleur.
- Fiche produit publique (`inertia/pages/products/show.vue`) : section
  « Marquage » (positions + techniques + grille de prix de marquage).

## Données de référence

- `database/data/catalogue/marking_techniques.ts` : 18 techniques canoniques
  (familles + synonymes + libellés FR/EN) ; `marking_technique_seeder.ts` (avant
  `product_seeder`).
- Produit de démo « casquette-6-panneaux-marine » : `printable`, 3 positions,
  techniques et grille de prix de marquage (`database/seeders/product_seeder.ts`).
- Factories : `MarkingTechnique` (+ translation) et les trois tables produit.

## Tests

- `tests/functional/supplier_product_marking.spec.ts` (PostgreSQL) : ajout
  positions + techniques + grille, remplacement d'ensemble, cascade de suppression
  produit, technique inconnue rejetée, contrainte du gabarit (`marking_template`),
  résolution i18n des techniques (fr vs en).

## i18n

- `resources/lang/{fr,en}/products.json` : section « Marquage » du formulaire
  (positions, techniques, grille de prix) et libellés de la fiche publique.
