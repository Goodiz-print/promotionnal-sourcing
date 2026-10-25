# Retrait de la recherche PostgreSQL (#112, PR 3/3)

> Date : 2026-10-25

La recherche de produits ne vit plus que dans Meilisearch (ADR 0002, décision 13). Cette PR retire ce que PostgreSQL ne sert plus.

- **Migration `…drop_postgres_search_columns`** (nouvelle, `down()` implémenté) : supprime `products.embedding` (`halfvec`) et `products.embedding_key` avec l'index HNSW `products_embedding_idx`, ainsi que `product_translations.search_vector` (`tsvector`) avec ses index GIN par locale. `down()` recrée des colonnes vides (vecteurs : `node ace search:reindex` ; tsvector : réécrire la traduction). L'extension `vector` reste installée : les anciennes migrations la créent.
- **Code supprimé** : `ProductTranslationSearchService`, `LOCALE_TSCONFIG` / `DEFAULT_TSCONFIG`, l'entrée correspondante de `database/schema_rules.ts`, la recherche full-text de `ProductCatalogueService#list` et `ProductCatalogueService#lookupForRfq` (`ILIKE`). `TranslationService` et `SupplierProductService` ne recalculent plus de vecteur : l'index est resynchronisé par l'événement `ProductChanged`.
- **Plus de repli sur PostgreSQL pour la recherche** : si Meilisearch est inerte ou injoignable, la recherche l'est aussi, **avec un message explicite** — catalogue : prop `searchUnavailable` (`products.index.searchUnavailable`) ; sélecteur de produit des demandes de devis : prop `productSearchUnavailable` (`rfq.product.unavailable`). La **navigation** sans terme (catégories, filtres, tri par prix) reste servie par PostgreSQL. Textes ajoutés dans les 9 langues.
- **Ajouter une langue de contenu** ne demande plus d'index ni de migration : une entrée dans `CONTENT_LOCALES` suffit.
- **Tests** : `catalogue_fts.spec.ts` supprimé ; le sélecteur RFQ est testé avec le moteur factice (résultats, saisie courte, produits inactifs, moteur indisponible) ; contrôle que les colonnes et index retirés ont disparu.
- **Non traité** : les traductions de l'ADR 0002 (décision 12 : titres à l'import, descriptions à la première ouverture) feront l'objet d'une PR dédiée ; les configurations de recherche PostgreSQL et les dictionnaires hunspell de l'image (#84) ne servent plus mais leur retrait est une opération distincte.
