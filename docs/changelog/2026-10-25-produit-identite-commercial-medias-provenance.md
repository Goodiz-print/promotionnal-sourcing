# Produit : identité, commercial, médias et provenance (ÉTAPE 2)

> Date : 2026-10-25

ÉTAPE 2 du plan d'extension du modèle produit (`docs/product-model-extension-plan.md`,
« Séquencement conseillé » point 2 — écarts 5, 7, 8, 9). Colonnes simples sur
`products`, `product_translations`, `product_variants`, `product_images` et
`supplier_profiles`, sans nouvelle table. Aucune modification du marquage
(écart 2), de la logistique (écart 3) ni de la conformité (écart 4), traités
ultérieurement.

## Base de données (migrations d'altération, avec `down()`)

- **`products`** — identité/classification (écart 5), commercial (écart 7),
  médias (écart 8), provenance dérivée (écart 9) :
  - `brand` (string null), `hs_code` (string null, code douanier),
    `is_configurable` (bool, défaut `false`),
    `lifecycle_status` (enum `active` / `new` / `end_of_series` / `retired`,
    défaut `active` — distinct de `is_active`, qui reste l'interrupteur de
    publication), `released_at` (date null, filtre « Nouveautés »),
    `supplier_category_raw` (string null, traçabilité import) ;
  - `lead_time_days` (int null), `rush_service` (bool, défaut `false`),
    `rush_lead_time_days` (int null) ;
  - `video_url` (string null) ;
  - `origin_zone` (enum `france` / `europe` / `other`, null) — **colonne dérivée**,
    jamais saisie, + index.
- **`product_translations`** (par locale) : `keywords` (text[] null),
  `marketing_points` (text[] null).
- **`product_variants`** : `gtin` (string null, EAN/GTIN).
- **`product_images`** : `role` (enum `primary` / `view` / `lifestyle` / `marked`,
  null).
- **`supplier_profiles`** : `default_origin_scope` (enum `france` / `europe` /
  `outside_europe` / `per_product`, null) — provenance par défaut déclarée par le
  fournisseur.

`database/schema.ts` régénéré par `node ace migration:run` (rollback + re-run
vérifiés).

## Dérivation de la provenance (`origin_zone`)

- Nouveau service injectable `ProductOriginService.deriveZone(originCountry,
madeInEurope)` : `france` si `FR` ; `europe` si pays ∈ UE/EEE
  (`EU_EEA_COUNTRY_CODES` dans `shared/types/country.ts`) **ou** `made_in_europe` ;
  `other` si pays connu hors Europe ; `null` (origine inconnue, exclue des cases
  France/Europe) sinon.
- Persistée au **save produit** (`SupplierProductService`, création et mise à jour
  — recalculée sur les valeurs effectives après merge) et **rattrapée au passage
  d'indexation** (`ProductIndexService`, qui réécrit `origin_zone` quand elle a
  changé). Jamais éditable depuis le formulaire.

## Recherche / Meilisearch

- Document d'index (`ProductSearchDocument`) : ajout de `originZone` et
  `releasedAt` (timestamp Unix secondes).
- Réglages `filterableAttributes` : ajout de `originZone` et `releasedAt`.
- `buildProductFilter` : provenance en **OU** groupé
  (`(originZone = 'france' OR originZone = 'europe')`), « Nouveautés » en intervalle
  `releasedAt >= <seuil>` (seuil = il y a `NEW_PRODUCT_WINDOW_DAYS` = 90 jours).
- Catalogue public : `ProductDirectoryFilters` reçoit `originZones` (OU) et
  `newOnly` ; appliqués au moteur **et** revérifiés sur PostgreSQL avec terme de
  recherche, directement en base sans terme (`ProductCatalogueService.list`).
  Query string : `?originZones[]=france&originZones[]=europe&newOnly=true`.
- **Réindexation** après déploiement : `node ace search:reindex` recalcule
  `origin_zone` et republie `originZone` / `releasedAt`. Détail : `docs/search.md`.

## Types, validators, formulaires

- `shared/types/product.ts` : enums `PRODUCT_LIFECYCLE_STATUSES`, `ORIGIN_ZONES`,
  `PRODUCT_IMAGE_ROLES`, constante `NEW_PRODUCT_WINDOW_DAYS` ; extension de
  `ProductType`, `ProductEditType`, `ProductVariantType`, `ProductTranslationType`,
  `ProductImageType` (`role`), `SupplierProductInput` / `SupplierProductUpdateInput`,
  `ProductDirectoryFilters`. `shared/types/organization.ts` : `DEFAULT_ORIGIN_SCOPES`
  - `SupplierProfileType` / `UpdateSupplierProfileData` (`defaultOriginScope`).
- Validators VineJS : nouveaux champs produit (brand, hs_code, is_configurable,
  lifecycle_status, released_at, supplier_category_raw, lead_time_days,
  rush_service, rush_lead_time_days, video_url), `keywords` / `marketing_points`
  par locale, `gtin` par variante, `default_origin_scope` côté profil fournisseur.
  `origin_zone` n'est **pas** saisissable.
- Formulaire produit fournisseur : nouvelle section « Identité, commercial et
  médias » (`product_commercial_fields.vue`), `gtin` sur la ligne de variante.
  Formulaire profil fournisseur : sélecteur « Provenance par défaut ». Barre de
  filtres catalogue : cases France / Europe / Hors Europe et bascule
  « Nouveautés ». Clés i18n fr + en.

## Reste à faire (UI)

- Édition du **rôle d'image** (`product_images.role`) : colonne, type et
  transformer livrés ; pas encore d'UI de saisie par image (flux d'upload actuel
  sans métadonnées par fichier).

## Tests

- `tests/unit/product_origin_service.spec.ts` : les 4 cas de dérivation (dont
  `null`).
- `tests/functional/product_identity_commercial.spec.ts` : persistance des
  champs, dérivation/recalcul d'`origin_zone`, filtres provenance (OU) et
  « Nouveautés » du catalogue.
- `tests/functional/search_indexing.spec.ts` : `originZone` / `releasedAt` dans le
  document, backfill d'`origin_zone` au passage d'indexation.
- `tests/unit/meilisearch_engine.spec.ts` : clauses de filtre provenance et
  nouveautés.
- Seeder : produit de démo « casquette » enrichi (marque, code HS, statut
  `new`, date de sortie récente, délais, service express, mots-clés, arguments
  marketing, vidéo) pour valider les filtres bout en bout.
