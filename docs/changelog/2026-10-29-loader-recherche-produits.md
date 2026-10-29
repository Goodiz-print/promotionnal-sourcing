# Loader de la page de recherche produits

> Date : 2026-10-29

Pendant qu'une recherche, un filtre ou un changement de page recharge `products.index`,
la grille de résultats est remplacée par 6 squelettes de vignettes produit (`role="status"`,
libellé `products.index.loading` dans les 9 langues).

- `BaseSkeleton` (`inertia/components/base/`) : bloc générique, utilitaire CSS `skeleton`
  (reflet animé, désactivé avec `prefers-reduced-motion`).
- `ProductCardSkeleton` : mêmes proportions que `ProductCard`.
- `useVisitLoading` : `loading` vrai pendant une visite GET Inertia vers la page courante,
  avec un délai de 150 ms pour éviter le clignotement.
