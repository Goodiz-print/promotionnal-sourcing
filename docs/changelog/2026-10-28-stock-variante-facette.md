# Stock par variante + facette de recherche « Stock »

> Date : 2026-10-28

Avant-dernier reliquat du plan d'extension du modèle produit
(`docs/product-model-extension-plan.md`, L98) : le **stock** vit au niveau des
**variantes** (`product_variants`) ; la recherche l'expose comme **facette
filtrable transverse aux catégories**, **agrégée au niveau produit**. La saisie
fournisseur est incluse.

Hors périmètre (features distinctes) : buckets de tranches **prix / MOQ**, et
toute notion de réservation / décrément de stock à la commande ou d'historique.

## Décisions actées

- **Deux colonnes sur `product_variants`** : `stock_quantity` (entier, nullable,
  informatif) et `stock_status` (enum `in_stock` / `out_of_stock` / `on_order`,
  nullable = inconnu). Mêmes conventions d'enum que `lifecycle_status` /
  `origin_zone` (`table.enum`).
- **Facette `stockStatus` au niveau produit, agrégée** depuis les variantes
  **actives** avec la sémantique **« priorité au disponible »**
  (`ProductStockService.deriveStatus`) : `in_stock` si **au moins une** variante
  active est `in_stock` ; sinon `on_order` ; sinon `out_of_stock` ; sinon `null`
  (aucune variante active n'a de statut → le produit n'apparaît sous aucune valeur
  de la facette). Seules les variantes `is_active = true` comptent.
- **`products.stock_status` est une colonne dérivée persistée** (comme `is_eco` /
  `origin_zone`), recalculée et sauvée dans
  `ProductIndexService.backfillDerivedColumns` à chaque (ré)indexation. PostgreSQL
  reste la source de vérité ; `node ace search:reindex` rattrape les changements.

## Migrations

- `alter_product_variants_add_stock` : `stock_quantity` (integer unsigned,
  nullable) + `stock_status` (enum nullable). `down()` droppe les deux.
- `alter_products_add_stock_status` : `stock_status` (enum nullable) + index.
  `down()` droppe l'index puis la colonne.
- `database/schema.ts` régénéré par `node ace migration:run` (jamais édité à la
  main) : `ProductVariantSchema` / `ProductSchema` récupèrent les colonnes.
  `ProductVariant` et `Product` redéclarent `stockStatus` en `ProductStockStatus |
null` (comme `originZone`).

## Saisie fournisseur

- `shared/types/product.ts` : `PRODUCT_STOCK_STATUSES` / `ProductStockStatus`
  (modèle `ORIGIN_ZONES`) ; `stockQuantity` + `stockStatus` ajoutés à
  `ProductVariantType` (exposé au front) et `ProductVariantInput` (`undefined` =
  inchangé, comme `gtin`).
- `app/validators/supplier_product.ts` : `stockQuantity` (entier ≥ 0 borné,
  optionnel/nullable), `stockStatus` (enum, optionnel/nullable).
- `ProductVariantService.syncVariants` : `stockQuantity` / `stockStatus` fusionnés
  dans les **deux** branches (update par `merge`, création), sémantique
  `undefined` = inchangé.
- `ProductVariantTransformer` expose les valeurs (aller-retour édition).
- UI : `inertia/components/products/form/product_variant_row.vue` — champ quantité
  (numérique ≥ 0) + select statut (3 valeurs + « non renseigné »), via les
  `base_*` existants. Form state `ProductVariantFormRow` + `product_form.vue` +
  `product_variants_fields.vue` étendus ; `payload.ts` transmet les champs.

## Agrégation & indexation

- `app/services/product_stock_service.ts` (injectable, logique pure) :
  `deriveStatus(variants)` implémente la priorité ci-dessus.
- `ProductIndexService` : injecte `ProductStockService`, précharge les variantes
  dans `documentsFor` (**colonnes utiles seulement** : `id`, `product_id`,
  `is_active`, `stock_status`), recale `product.stockStatus` dans
  `backfillDerivedColumns` (n'écrit que si la valeur change, comme `is_eco` /
  `origin_zone`), émet `stockStatus` dans `toDocument`.

## Document d'index & moteur

- `shared/types/search.ts` : `ProductSearchDocument.stockStatus: ProductStockStatus
| null`, `ProductSearchFilter.stockStatuses?: ProductStockStatus[]`, constante
  `STOCK_FACET_FIELD` (`stockStatus`).
- `meilisearch_engine.ts` : `stockStatus` ajouté aux `filterableAttributes` ;
  clause `buildProductFilter` pour `stockStatuses` — **OU** entre les statuts
  cochés (`(stockStatus = 'in_stock' OR stockStatus = 'on_order')`), groupée pour
  rester en ET avec les autres critères (à la manière d'`originZones`). Littéraux
  d'enum construits côté serveur, jamais de texte utilisateur.

## Contrôleur, repli PostgreSQL & UI catalogue

- `ProductsController#index` : `parseStockStatuses(qs.stockStatuses)` (répété/unique,
  filtré sur l'enum — comme `parseOriginZones`), propagé dans
  `ProductDirectoryFilters.stockStatuses`.
- `ProductCatalogueService.list` (navigation sans terme) : `whereIn('stockStatus',
stockStatuses)` (OU) — mêmes résultats que le moteur.
- `ProductSearchService` : passe `stockStatuses` au filtre moteur et **revérifie**
  sur la base au rechargement (`reload`). `CatalogueCertificationFacetService`
  cadre aussi sa distribution par `stockStatuses`.
- UI : facette « Stock » dans `inertia/components/catalogue_filters.vue` (cases à
  cocher, transverse aux catégories comme provenance, donc toujours affichée) ;
  `inertia/pages/products/index.vue` propage le paramètre de visite (`router.get`,
  pas de fetch/CSRF manuel).

## i18n

- `resources/lang/{fr,en}/products.json` : `products.index.stock.{title,in_stock,
out_of_stock,on_order}` (filtre catalogue) et `products.manage.variants.{stockQuantity,
stockStatus,stockUnknown,stockStatuses.<slug>}` (formulaire).

## Tests

- `tests/unit/product_stock_service.spec.ts` : `deriveStatus` — toutes les
  combinaisons de priorité, variantes inactives ignorées, `null` sans info.
- `tests/functional/product_stock.spec.ts` : document d'index porte le statut
  agrégé (priorité au disponible, inactives ignorées, `null`), colonne dérivée
  persistée au backfill, transmission du filtre au moteur, filtre catalogue par
  statut en repli PostgreSQL (un statut, OU sur plusieurs), saisie round-trip
  (création + `undefined` = inchangé à la mise à jour).
- `tests/inertia/products.spec.ts` : la facette « Stock » s'affiche et pousse le
  bon paramètre (`stockStatuses`).

## Réindexation

- `node ace search:reindex` peuple la facette : réapplique les réglages (dont
  `stockStatus` filtrable) et recale `products.stock_status` (backfill
  d'agrégation) avant de réécrire tous les documents.
