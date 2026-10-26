# Produit : conformité — certifications, éco-responsable, type de document (ÉTAPE 3)

> Date : 2026-10-25

ÉTAPE 3 du plan d'extension du modèle produit (`docs/product-model-extension-plan.md`,
« Séquencement conseillé » point 3 — écart 4, Conformité produit). Ajoute les
labels de conformité **au niveau produit**, la part de matière recyclée, une
mise en garde, un filtre dérivé « Éco-responsable » et la nature d'une fiche PDF.
Aucune modification du marquage structuré (écart 2) ni de la logistique
(écart 3), traités ultérieurement.

## Base de données (migrations avec `down()`)

- **`certifications`** (nouveau référentiel fermé, ~30 labels) : `slug` (unique),
  `domain` (enum `environment` / `textile` / `social` / `safety` / `food_contact`
  / `forestry` / `quality`), `is_eco` (bool, marque les labels éco pour la
  dérivation), `synonyms` (text[]), `source_locale`. Mêmes colonnes neutres que
  les attributs ; les libellés vivent dans **`certification_translations`**
  (`certification_id`, `locale`, `name`, `is_auto`, unique par couple).
- **`product_certifications`** (pivot) : `product_id` + `certification_id` en
  **clé primaire composite**, index sur `certification_id`. Certifications au
  niveau produit ; `supplier_profiles.certifications` (profil fournisseur) reste
  inchangé.
- **`products`** : `recycled_content_percent` (int null, 0-100), `caution_comment`
  (text null), `is_eco` (bool, défaut `false`) — **colonne dérivée**, jamais
  saisie, + index.
- **`product_documents`** : `type` (enum `spec_sheet` / `safety` / `certificate` /
  `marking_template` / `other`, défaut `spec_sheet`) — sert aussi au futur gabarit
  de marquage (écart 2).

`database/schema.ts` est régénéré par `node ace migration:run` (jamais édité à la
main).

## Dérivation « Éco-responsable » (`products.is_eco`)

Filtre dérivé, **jamais saisi**, calculé par le nouveau service injectable
`ProductEcoService.deriveIsEco` : vrai si `recycled_content_percent > 0`, **ou**
le produit porte une matière éco-responsable (bio / recyclé / naturel —
`ECO_MATERIAL_SLUGS` dans `shared/types/certification.ts` : plastique recyclé,
bioplastique, coton bio, coton/polyester recyclé, bambou, liège, jute, bois),
**ou** au moins un label `certifications.is_eco`. Branché au **même endroit
qu'`origin_zone`** : persisté au save produit (`SupplierProductService`, après
synchronisation des facettes et des labels) et rattrapé (backfill) au passage
d'indexation (`ProductIndexService`). Exposé comme facette Meilisearch filtrable
`isEco` (mapping + `buildProductFilter` + document + réindexation), et comme filtre
catalogue `ecoOnly` (Meilisearch + repli PostgreSQL). Voir `docs/search.md`.

## Backend

- Types : `shared/types/certification.ts` (nouveau : `CertificationType`,
  `CERTIFICATION_DOMAINS`, `ECO_MATERIAL_SLUGS`), extension de `shared/types/product.ts`
  (`recycledContentPercent`, `cautionComment`, `isEco`, `certificationIds`,
  `ecoOnly`), `shared/types/document.ts` (`PRODUCT_DOCUMENT_TYPES`,
  `ProductDocumentFile`), `shared/types/search.ts` (`isEco`).
- Modèles : `Certification` (+ `translations`, `products`),
  `CertificationTranslation` ; relation `Product.certifications` (manyToMany) ;
  `ProductDocument.type`.
- Validation (`supplier_product`) : `recycled_content_percent` (0-100),
  `caution_comment` (≤ 2000), `certificationIds` ; `product_documents.type` dans
  `document`. `is_eco` n'est **pas** saisissable.
- Transformers : `CertificationTransformer` ; `recycledContentPercent` /
  `cautionComment` / `isEco` dans product + edit, `certifications` dans la fiche
  détaillée, `type` dans le document produit.

## Frontend (fournisseur + catalogue)

- Formulaire produit : nouvelle section « Conformité » (`product_compliance_fields.vue`)
  — part de recyclé, mise en garde, sélection multiple des labels. Le gestionnaire
  de documents (`document_manager.vue`, généralisé) propose la **nature** du
  document (`type`).
- Catalogue : case « Éco-responsable » dans `catalogue_filters.vue`.

## Données de référence & démo

- Référentiel des ~30 labels (`database/data/catalogue/certifications.ts` +
  `certification_seeder`, enregistré dans `MainSeeder` avant les produits).
- Produit de démo « casquette 6 panneaux marine » enrichi : labels GOTS +
  OEKO-TEX, `recycled_content_percent = 35`, mise en garde → `is_eco` vrai bout
  en bout (matière bio, label éco **et** recyclé).

## Tests (Japa, PostgreSQL, factories)

- `tests/functional/product_compliance.spec.ts` : persistance (recyclé, mise en
  garde, labels), dérivation `is_eco` (vrai via recyclé / matière éco / label éco ;
  faux sans aucun critère ; recalcul à la mise à jour), filtrage
  « Éco-responsable » du catalogue, colonne `product_documents.type` (valeur
  saisie + défaut).
- `tests/unit/product_eco_service.spec.ts` : la dérivation pure, cas vrai/faux.
