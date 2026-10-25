# Facettes aplaties par slug, distributions et barre de filtres par catégorie

> Date : 2026-10-25

Deuxième PR du plan d'extension du modèle produit (écart 6), annoncée par
l'ÉTAPE 1 : exposer dans Meilisearch des **facettes aplaties par slug** pour
obtenir les **distributions de facettes** (compteurs par valeur) et piloter une
**barre de filtres dépendante de la catégorie** sur le catalogue public. Cette PR
**n'ajoute pas** de comportement de filtrage — le ET multi-critères (dont couleur
N1/N2) fonctionne déjà via `attributeValueIds`.

## Indexation

- `ProductSearchDocument` porte un nouvel objet `attributes` **aplati par slug
  d'attribut** (`attributes.color`, `attributes.color-shade`, `attributes.material`,
  `attributes.cap-panels`…), construit par `ProductIndexService.flattenedFacets` :
  - une valeur énumérée porte son **identifiant** (`attribute_values.id`) sous le
    slug de son attribut ;
  - la couleur **famille** (N1) est émise sous `attributes.color` **même quand le
    produit ne porte qu'une nuance** (N2), dérivée du `parent_value_id` ;
  - un attribut numérique porte sa **valeur brute**.
- Préchargement de `attributeValue.parent.attribute` pour la déduction N1.

## Réglages de l'index dérivés de la base

- `FilterableFacetsService.filterableSlugs()` (nouveau, requête `db` brute, aucun
  modèle Lucid) : slugs `category_attributes.is_filter = true`, distincts et triés.
- `productIndexSettings(facetSlugs)` ajoute un `filterableAttributes`
  `attributes.<slug>` par slug filtrable — **jamais une liste codée en dur**.
  `MeilisearchEngine` injecte `FilterableFacetsService` (optionnel : vide dans les
  tests unitaires) et réapplique les réglages au premier envoi d'un processus et à
  chaque reindex. Un changement de `is_filter` est pris en compte au prochain
  `search:reindex`.

## Distributions de facettes & barre de filtres

- `SearchEngine.facetDistribution({ query, filter, facets })` (nouveau ;
  `NullSearchEngine` → `{}`) : Meilisearch `search` avec `facets` + `limit: 0`,
  renvoie `facetDistribution` (compteurs par valeur).
- `CatalogueFacetBarService.forCategory(categoryId, locale, { search, madeInEurope })`
  (nouveau, injecté) : attributs filtrables résolus par `CatalogueFacetsService`
  (propres + hérités des ancêtres) enrichis des compteurs. Sans catégorie, barre
  d'attributs vide ; moteur inerte ou injoignable → `hasCounts: false`,
  `count: null`. Distribution cadrée par la catégorie (+ terme de recherche et
  made-in-Europe), **sans** les valeurs déjà cochées.
- Types : `shared/types/search.ts` (`FacetDistribution`, `FacetDistributionRequest`,
  `facetField`, `FACET_FIELD_PREFIX`, champ `attributes` sur `ProductSearchDocument`) ;
  `shared/types/category.ts` (`CategoryFacetBarType`, `CategoryFacetType`,
  `CategoryFacetValueType`, `CategoryFacetRangeType`).

## Catalogue public (frontend)

- `ProductsController#index` expose désormais la prop `facetBar` (au lieu de la
  liste globale `attributes`) ; `filters` et `facetBar` sont rechargés ensemble à
  chaque visite partielle (`router.get` `only`).
- `inertia/components/catalogue_filters.vue` reçoit `facetBar` ; changer de
  catégorie réinitialise les valeurs cochées. Nouveau composant
  `inertia/components/catalogue/facet_group.vue` : pastille **hex** des couleurs,
  **compteurs** par valeur, masquage des valeurs à 0 (sauf cochées), tranches
  numériques affichées avec leur compteur. Mutations via `router.*` (aucun
  `fetch`/CSRF manuel), contrôleur en rendu Inertia.
- i18n (`resources/lang/{fr,en}/products.json`) : `index.selectCategoryForFilters`,
  `index.rangeUnder`, `index.rangeOver`, `index.rangeBetween`.

## Backfill

`node ace search:reindex` suffit : il réapplique les réglages (dont les
`attributes.<slug>` filtrables dérivés de la base) et réécrit tous les documents
avec leur objet `attributes`.

## Tests

- `tests/functional/search_indexing.spec.ts` : facettes aplaties par slug, couleur
  famille N1 déduite de la nuance N2.
- `tests/functional/catalogue_facet_bar.spec.ts` (nouveau) : dérivation des slugs
  filtrables ; barre par catégorie (attributs résolus, facettes demandées, fusion
  des compteurs, repli sans compteur).
- `tests/unit/meilisearch_engine.spec.ts` : `facetDistribution` (`facets` +
  `limit: 0` + lecture de `facetDistribution`, aucun champ demandé → aucun appel).
- `tests/functional/products_directory.spec.ts` : prop `facetBar` sans/avec
  catégorie.
- `tests/inertia/products.spec.ts` : barre par catégorie (valeurs + compteurs,
  masquage des 0, invitation à choisir une catégorie).
