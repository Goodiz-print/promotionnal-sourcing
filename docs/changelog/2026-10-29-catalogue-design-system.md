# Catalogue et annuaire fournisseurs sur le design system

> Date : 2026-10-29

Migration des pages `products.index` (`/:locale/products`) et `suppliers.index`
(`/:locale/suppliers`) vers les composants base du design system
(`docs/design-system.md`), sans changement de routes ni de paramètres de requête.

## Catalogue produits (`inertia/pages/products/index.vue`)

- `BasePageHeader` (titre + sous-titre existants), grille `280px / 1fr` : filtres
  dans une `BaseCard` collante à gauche, résultats à droite.
- Barre de résultats avec compteur tabulaire, `BaseAlert` (warning) quand la
  recherche est indisponible, `BaseEmptyState` sans résultat, `BasePagination`
  à la place du pager recopié en ligne.
- Carte produit (`inertia/components/product_card.vue`) : `BaseCard hover`,
  image carrée ou pictogramme de repli (lucide `Image`), prix en indigo
  tabulaire, MOQ (`products.card.minQuantity`) et badges `BaseBadge` dérivés du
  type `ProductType` : made-in-Europe (`madeInEurope`), éco (`isEco`), nouveauté
  (`lifecycleStatus === 'new'`).

## Barre de filtres (`inertia/components/catalogue_filters.vue`)

- Nouveau bouton **« Réinitialiser »** (`products.index.reset`), affiché dès
  qu'un filtre est actif (recherche, catégorie, interrupteurs, facettes) : vide
  tout l'état local et recharge le catalogue sans filtre (page 1).
- Titres de groupe en eyebrow, séparateurs hairline, compteurs de facettes
  tabulaires. État local déplacé dans le composable
  `inertia/composables/use_catalogue_filters.ts` ; markup commun extrait dans
  `inertia/components/catalogue/facet_section.vue` (séparateur + titre) et
  `facet_option.vue` (pastille couleur + libellé + compteur).

## Annuaire fournisseurs (`inertia/pages/suppliers/index.vue`)

- `BasePageHeader`, filtres dans une `BaseCard`, compteur de résultats
  (`suppliers.index.resultsCount`), `BaseEmptyState`, `BasePagination`.
- Carte fournisseur (`inertia/components/supplier_card.vue`) : `BaseCard hover`,
  logo `size-12` ou pictogramme (lucide `Building2`), nom `text-heading-sm`,
  pays en caption, description sur deux lignes.

## Clés i18n ajoutées (fr + en)

- `products.index.filtersTitle`, `products.index.reset`,
  `products.index.quickFilters`, `products.index.emptyHint`
- `products.card.minQuantity`, `products.card.madeInEurope`,
  `products.card.eco`, `products.card.new`
- `suppliers.index.resultsCount`, `suppliers.index.emptyHint`

## Tests

`tests/inertia/products.spec.ts` (bouton Réinitialiser, MOQ/badge sur la carte)
et `tests/inertia/suppliers.spec.ts` (compteur, pictogramme de repli).
