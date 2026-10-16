# Phase 1 : catalogue public produits (recherche puissante, lecture)

> Date : 2026-07-11

Expose publiquement (sans auth) le catalogue produits : liste filtrable +
fiche détaillée, avec une **recherche full-text locale-aware** et le
**filtrage à facettes en ET fiable**. Première tranche applicative de l'issue #2
(la couche données EAV/i18n existait déjà) ; le CRUD fournisseur et les
embeddings Mistral restent à faire.

- **Routes publiques** (`:locale`, hors auth) : `GET /products` (`products.index`),
  `GET /products/:slug` (`products.show`).
- **Service** `product_catalogue_service.ts` : liste paginée + filtres. Recherche
  **FTS PostgreSQL** locale-aware via `product_translations.search_vector`
  (`websearch_to_tsquery(<config locale>, …)`, `LOCALE_TSCONFIG`) ; filtre
  catégorie et made-in-Europe ; **facettes attributs en ET fiable** (un `whereHas`
  par valeur → combinaison `AND`). `findBySlug` (fournisseur/catégorie/facettes
  préchargés), `availableCategories`, `filterableAttributes`.
- **Controller** `products_controller.ts` (public) ; **exception**
  `app/exceptions/catalogue_errors.ts` (`ProductNotFoundException` → 404).
- **Transformer** `ProductDetailTransformer` (produit, résumé fournisseur/catégorie,
  facettes résolues). `CategoryTransformer`/`AttributeTransformer`/
  `AttributeValueTransformer` rendus **Inertia-safe** (retour typé, dates ISO) ;
  `CategoryType`/`AttributeType`/`AttributeValueType`/`AttributeWithValuesType`
  passés d'`interface` à `type` (contrainte props Inertia `Record<string, JSON>`).
- **Types partagés** : `ProductDirectoryFilters`, `ProductCatalogueFacets`,
  `ProductDetailType`, `ProductDetailAttributeType` (`shared/types/product.ts`).
- **Frontend** : `inertia/pages/products/{index,show}.vue` + composants
  `catalogue_filters.vue` (recherche debouncée, select catégorie, toggle
  made-in-Europe, cases à cocher facettes) et générique `base_checkbox.vue` ;
  réutilise `product_card.vue`. i18n `resources/lang/{fr,en}/products.json`.
- **Tests** : `tests/functional/products_directory.spec.ts` (FTS FR/EN, filtres,
  ET fiable via HTTP, fiche, 404) + `tests/inertia/products.spec.ts`.
