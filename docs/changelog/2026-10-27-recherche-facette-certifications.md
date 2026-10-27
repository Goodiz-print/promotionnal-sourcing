# Recherche : facette certifications filtrables (ÉTAPE 6 — finalisation Meilisearch)

> Date : 2026-10-27

ÉTAPE 6 (dernière) du plan d'extension du modèle produit : expose les **labels
de conformité** (écart 4, modélisés à l'ÉTAPE 3 via le pivot
`product_certifications`) comme **facette filtrable** de bout en bout dans la
recherche et le catalogue. C'est le dernier élément de la liste de facettes du
plan qui correspondait à un champ déjà modélisé mais pas encore exposé en
recherche.

Rappel : `is_eco` / provenance (3 états) / « Nouveautés » étaient déjà des
facettes filtrables (ÉTAPES 2–3) ; cette entrée ne les retouche pas. Aucune
migration, aucune colonne : `certificationIds` est une **donnée directe** (pivot
`product_certifications`), pas dérivée.

## Document d'index & réglages (`ProductSearchDocument`)

- Nouveau champ `certificationIds: number[]` (identifiants des labels du produit),
  rempli par `ProductIndexService.toDocument` depuis `product.certifications`
  (déjà préchargé). **Pas de backfill** : donnée directe — `node ace search:reindex`
  suffit à peupler la facette.
- `productIndexSettings` : `certificationIds` ajouté aux `filterableAttributes`
  (champ **plat**, transverse aux catégories — contrairement aux attributs EAV
  aplatis sous `attributes.<slug>`). Constante `CERTIFICATION_FACET_FIELD`
  (`shared/types/search.ts`).

## Filtre moteur (`buildProductFilter`)

- Sémantique **ET exact** comme `attributeValueIds` : une clause par label
  (`certificationIds = X AND certificationIds = Y` exige **tous** les labels
  cochés). Valeurs = entiers construits côté serveur, jamais de texte utilisateur.
- `ProductSearchFilter.certificationIds?: number[]`.

## Distribution de facettes & barre de filtres

- `CatalogueCertificationFacetService` (`app/services/catalogue_certification_facet_service.ts`,
  injecté) : barre de filtres **certifications globale**. **Choix d'emplacement** :
  les certifications sont **transverses aux catégories** (à la différence des
  attributs EAV, dépendants de la catégorie et portés par `CatalogueFacetBarService`),
  donc la barre est assemblée **dans le contrôleur**, disponible **sans catégorie
  sélectionnée**. Elle part du référentiel fermé (`certifications`, ~29 labels)
  enrichi des compteurs de `facetDistribution` sur `certificationIds`. Le cadrage
  de la distribution reprend les autres filtres (catégorie, terme, made-in-Europe,
  provenance, nouveautés, éco) **sans** les labels déjà cochés (un label coché
  garde un compteur, les autres restent non nuls). Moteur indisponible : labels
  renvoyés sans compteur (`hasCounts: false`).

## Contrôleur & types

- `ProductsController#index` : parse `qs.certificationIds` (répété/unique →
  `number[]`) via `parseIds`, propage dans `ProductDirectoryFilters`, passe la
  prop `certificationFacet`.
- `ProductDirectoryFilters.certificationIds: number[]`,
  `CertificationFacetType` / `CertificationFacetBarType` (`shared/types/certification.ts`).

## Repli PostgreSQL (navigation sans terme)

- `ProductCatalogueService.list` : filtre par certifications via la relation M2M,
  un `whereHas` par label (ET fiable) — **mêmes résultats que le moteur**.
- `ProductSearchService.reload` revérifie chaque label sur PostgreSQL : le ET est
  garanti deux fois (filtre moteur puis rechargement).

## UI catalogue

- `inertia/components/catalogue/certification_facet.vue` : cases à cocher
  **groupées par domaine** (`t('products.index.certifications.domains.<slug>')`),
  compteurs, masquage des labels à 0 (sauf cochés), libellés via `t()`.
- Branché dans `catalogue_filters.vue` (état `certificationIds`, toggle) et
  `inertia/pages/products/index.vue` (prop `certificationFacet`, paramètre de
  visite, rechargement partiel). Mutations via `router.get` (pas de fetch/CSRF
  manuel).

## i18n

- `resources/lang/{fr,en}/products.json` : `products.index.certifications.title`
  - `products.index.certifications.domains.<slug>` pour les 7 domaines.

## Tests

- `tests/functional/catalogue_certifications.spec.ts` : filtrage par une
  certification (sous-ensemble), **ET** sur plusieurs certifications, combinaison
  avec un autre critère (made-in-Europe), transmission au moteur et revérification
  au rechargement.
- `tests/functional/catalogue_certification_facet.spec.ts` : fusion des compteurs,
  cadrage excluant les labels cochés, repli sans compteur (moteur inerte ou
  injoignable).
- `tests/functional/search_indexing.spec.ts`, `tests/unit/meilisearch_engine.spec.ts`,
  `tests/inertia/products.spec.ts` : document d'index, clause de filtre ET, rendu
  de la barre.

## Réindexation

- `node ace search:reindex` peuple la facette (réapplique les réglages — dont
  `certificationIds` filtrable — et réécrit tous les documents). Pas de colonne à
  backfiller.

## Reliquats futurs (hors de cette PR)

- Buckets de tranches **prix / MOQ** : feature UI de buckets distincte, non
  modélisée.
- `stock_status` : colonne inexistante — pas de filtre à ce stade.
