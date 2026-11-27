# Import fournisseurs : slug unique en une seule requête

> Date : 2026-11-27

Issue #248. À la création d'une fiche par `supplier:import`, le slug libre
(`<fournisseur>-<code>`, puis `-2`, `-3`…) ne se cherche plus par une requête
SQL par collision dans la transaction produit :

- **Une seule lecture** par fiche, quel que soit le nombre de collisions :
  `slug = base OR slug LIKE 'base-%'` (base échappée pour `LIKE`, `_` étant
  conservé par le slug), puis premier suffixe libre calculé en mémoire
  (`firstFreeSlug`, `shared/helpers/slug.ts`). Les slugs voisins non numériques
  (`…-ab-12-extra`) sont ignorés, un trou dans les suffixes est comblé.
- **Index `products_slug_pattern_index`** (`slug varchar_pattern_ops`, créé
  `CONCURRENTLY`) : l'index unique de `slug` suit la collation de la base et ne
  sert pas un `LIKE` par préfixe ; sans ce nouvel index, la lecture parcourrait
  toute la table `products` à chaque fiche créée.
- **Slug trop long** : la base est tronquée à 247 caractères (`truncateSlugBase`)
  pour que `-N` tienne dans `products.slug` (255). Un code comme `€€€…` (où `€`
  devient `euro`) n'échoue plus.
- **Imports concurrents** : si deux imports prennent le même slug entre la
  lecture et l'écriture, la violation d'unicité relance une fois la transaction
  de la fiche (`retryOnceOnUniqueViolation`, `shared/helpers/database.ts`),
  qui relit l'état validé. Seules les contraintes `products_slug_unique` et
  `products_supplier_id_external_id_unique` déclenchent ce nouvel essai ; une
  autre violation (SKU en double…) échouerait de nouveau et est propagée.

Tests : `tests/unit/slug.spec.ts`, `tests/unit/database_helpers.spec.ts`,
cas fonctionnels « slug déjà suffixé en base », « slug très long », nouvel essai
sur violation concurrente et absence de nouvel essai sur une autre contrainte
dans `tests/functional/supplier_feed_import.spec.ts`.
