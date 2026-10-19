# Plein texte multilingue : `search_vector` calculé par l'application (#84)

> Date : 2026-10-16

`product_translations.search_vector` n'est plus une colonne générée (`GENERATED ALWAYS … STORED`) mais une colonne `tsvector` ordinaire, calculée à l'écriture par `ProductTranslationSearchService` avec la config de `LOCALE_TSCONFIG` (source unique, plus de `CASE` SQL à synchroniser).

- Migration `1792200000000_product_translations_plain_search_vector` (avec `down()`) : recrée la colonne, backfill, puis un index GIN partiel par locale (`WHERE locale = 'fr'`, `'en'`). La migration d'origine n'est pas modifiée.
- Ajouter une langue ne réécrit plus la table : entrée dans `LOCALE_TSCONFIG` + `CREATE INDEX … WHERE locale` + backfill de ses lignes.
- Le service est appelé par `SupplierProductService` (création/édition) et par `ProductSeeder`.
- Tests : aucune traduction sans `search_vector`, recherche dans chaque langue de contenu, recalcul après modification d'un produit.
- Reste à faire (hors code) : relevés `\dFd`/`\dF` sur l'instance cible, hébergement pour les 14 langues sans racinisation (#80), mesure à 1 M de produits (#69).
