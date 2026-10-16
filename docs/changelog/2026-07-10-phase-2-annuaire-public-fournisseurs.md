# Phase 2 (PR 4/4) : annuaire public fournisseurs

> Date : 2026-07-10

Expose publiquement (sans auth) le catalogue des fournisseurs : liste
filtrable + fiche détaillée (profil fournisseur + catalogue produits). Clôt
la Phase 2.

- **Routes publiques** (`:locale`, hors auth) : `GET /suppliers` (`suppliers.index`),
  `GET /suppliers/:slug` (`suppliers.show`).
- **Controller** `suppliers_controller.ts` (public) + **service**
  `supplier_directory_service.ts` : liste paginée, filtre **pays**, recherche par
  **nom localisé** (`whereHas('translations').whereILike`) ; fiche avec preload
  `products` + `organization.supplierProfile` ; 404 si introuvable.
- **Transformer** `SupplierDetailTransformer` (fiche = supplier + profil + produits).
  `SupplierTransformer`/`ProductTransformer` rendus **Inertia-safe** (retour typé,
  dates en ISO) ; `SupplierType`/`ProductType` passés d'`interface` à `type`
  (contrainte props Inertia). Types `SupplierDetailType`, `SupplierDirectoryFilters`,
  `Paginated<T>`/`PaginationMeta` (nouveau `shared/types/pagination.ts`).
- **Frontend** : `inertia/pages/suppliers/{index,show}.vue` + composants réutilisables
  `supplier_card.vue` / `product_card.vue` ; filtres via `router.get` (preserveState,
  debounce) ; i18n `resources/lang/{fr,en}/suppliers.json`.
- **Tests** : `tests/functional/suppliers_directory.spec.ts` (7 cas) +
  `tests/inertia/suppliers.spec.ts`. Résultat : pg → 50 passés ; sqlite → 26 passés,
  24 sautés ; Vitest → 25.
- **Doc** : `docs/organisations.md` (section « Annuaire public »).
