# Masquer les filtres sans produit (provenance et stock)

Date : 2026-10-29

Les options des facettes **provenance** et **stock** sans aucun produit dans le jeu courant sont désormais masquées (sauf celles déjà cochées, pour pouvoir les décocher) ; un groupe entièrement vide disparaît. Les attributs, prix, MOQ et certifications masquaient déjà leurs valeurs à 0.

- `CatalogueEnumFacetService` : compteurs `originZone` / `stockStatus` via `facetDistribution`, cadrés par les autres filtres sans le critère compté.
- Prop Inertia `enumFacets` sur `products.index` (rechargée en partial reload).
- Moteur indisponible : `hasCounts: false`, toutes les options restent affichées.
