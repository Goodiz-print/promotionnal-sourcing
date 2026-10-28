# Filtrage par tranches numériques (EAV, prix, MOQ)

> Date : 2026-10-28

Dernier reliquat du plan d'extension du modèle produit (`docs/product-model-extension-plan.md`, L125) : le **filtrage par intervalle numérique** de bout en bout, appliqué aux tranches d'attributs de catégorie (EAV) **et** à deux nouvelles facettes transverses **Prix** et **Quantité minimum (MOQ)**.

Avant cette évolution, les tranches d'attributs étaient **comptées** et affichées dans la barre de facettes mais **non cliquables** (« filtrage à venir ») ; prix et MOQ n'étaient ni indexés ni filtrables.

## Décisions

- **Périmètre complet** : (a) mécanisme générique de filtrage par intervalle, (b) tranches EAV déjà comptées rendues **cliquables**, (c) nouvelles facettes **prix** (`products.price_min`, palier le plus bas) et **MOQ** (`products.min_quantity`) à buckets.
- **Sémantique `[min, max[`** partout (comptage, moteur, repli PostgreSQL) : borne basse **incluse**, borne haute **exclue** (pas de double comptage aux limites), une borne `null` est **ouverte**. Identique au comptage de tranches existant — factorisé dans `shared/helpers/numeric_ranges.ts` (`rangeContains`, `sumRangeCount`).
- **Bornes prix/MOQ = constante partagée** codée dans `shared/types/product.ts` (`PRICE_BUCKETS`, `MOQ_BUCKETS`), **pas** en base, **pas** via `category_attribute_ranges` (qui ne concerne que les attributs de catégorie). Le libellé n'est jamais stocké : rendu côté UI depuis les bornes + unité/devise + locale (`rangeBetween`/`rangeUnder`/`rangeOver`). Bornes : MOQ `<50, 50–100, 100–250, 250–500, 500–1000, ≥1000` ; prix (EUR) `<1, 1–2, 2–5, 5–10, 10–25, ≥25`.
- **Facettes transverses** : prix et MOQ vivent au niveau contrôleur + `catalogue_filters.vue` (comme certifications/stock), **disponibles sans catégorie sélectionnée**, avec compteurs. Les tranches EAV restent **dépendantes de la catégorie** (barre de facettes).
- **Combinaison** : plusieurs tranches d'un même champ se combinent en **OU** ; des champs/attributs différents en **ET**.

## Champs & routes

- **Document d'index** (`ProductSearchDocument`) : ajout de `priceMin: number | null` (le décimal `price_min` émis en nombre) et `moq: number | null` (`min_quantity`). Données **directes**, jamais dérivées → `search:reindex` suffit à peupler les facettes (pas de migration SQL).
- **Réglages d'index** (`productIndexSettings`) : `priceMin` et `moq` ajoutés aux `filterableAttributes` ; `faceting.maxValuesPerFacet` relevé à `1000` pour que le comptage par bucket de ces facettes transverses reste exact au-delà de 100 valeurs distinctes.
- **Filtre moteur** (`buildProductFilter`) : clause d'intervalle `(field >= min AND field < max)` par tranche, OU entre tranches d'un champ, le tout groupé pour rester en ET avec les autres critères. Champs : `priceMin`, `moq`, et `attributes.<slug>` pour l'EAV.
- **Contrôleur** (`GET /:locale/products`) — nouveaux paramètres de query, validés côté serveur (valeurs invalides ignorées) :
  - `priceBuckets`, `moqBuckets` : **index** dans la liste fermée partagée (le serveur ne fait jamais confiance à la query string pour les bornes) ;
  - `attributeRanges` : chaînes `"<slug>:<min>:<max>"` (borne vide = ouverte).
- **Repli PostgreSQL** (`ProductCatalogueService.list`, `ProductSearchService.reload`) : mêmes intervalles en SQL (`price_min`/`min_quantity` et `product_attributes.value_number`), mêmes résultats que le moteur — logique partagée dans `applyProductRangeFilters` (`app/services/product_range_filters.ts`).
- **Compteurs prix/MOQ** : `CatalogueNumericFacetService` calcule leur `facetDistribution` (indépendamment de la catégorie) et l'agrège en buckets ; `hasCounts: false` si le moteur est indisponible (buckets affichés sans compteur).

## UI

- `facet_group.vue` : tranches EAV désormais **cliquables** (cases, OU, état coché reflété, compteur conservé) — le TODO « filtrage à venir » est fermé.
- `numeric_facet_group.vue` (nouveau) : groupe générique de tranches prix/MOQ (libellés via le composable partagé `use_range_label`).
- `enum_facet_group.vue` (nouveau) : groupe générique de cases pour une énumération (provenance, stock) — extrait pour supprimer la duplication.
- `catalogue_filters.vue` : deux nouveaux groupes « Prix » et « Quantité minimum ». La sélection déclenche une visite Inertia `router.get` (preserveScroll), comme les autres filtres.

## Limite — devises

Les buckets de prix sont définis pour la **devise d'affichage par défaut (EUR)**. Pas de conversion multi-devises : le filtre porte sur `price_min` brut. Si `products.currency` varie, un produit est classé dans le bucket correspondant à la valeur numérique de `price_min` quelle que soit sa devise. La conversion multi-devises est hors périmètre.

## Réindexation

Pas de migration ni de colonne. `node ace search:reindex` réapplique les réglages (nouveaux `filterableAttributes`, `faceting`) et réécrit `priceMin`/`moq` pour peupler les facettes.

## Tests

- `tests/unit/numeric_ranges.spec.ts` : bornes incluses/exclues, borne `null` ouverte, valeurs hors buckets, résolution des index de buckets.
- `tests/unit/meilisearch_engine.spec.ts` : clauses d'intervalle prix/MOQ/EAV (`[min, max[`, OU/ET, groupement).
- `tests/functional/product_numeric_facets.spec.ts` : document d'index (`priceMin`/`moq`), transmission au moteur + ignorance des valeurs invalides, repli PostgreSQL (prix, MOQ, EAV).
- `tests/inertia/products.spec.ts` : rendu des facettes prix/MOQ et des tranches EAV cliquables, params poussés.
