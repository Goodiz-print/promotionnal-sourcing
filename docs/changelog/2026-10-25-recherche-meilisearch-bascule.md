# Recherche Meilisearch : bascule du catalogue et du sélecteur RFQ (#112, 2/3)

> Date : 2026-10-25

Le catalogue public et le sélecteur de produit des demandes de devis interrogent Meilisearch quand il est disponible. PostgreSQL reste en repli jusqu'à la PR 3.

- **`ProductSearchService`** : vecteur de la requête (provider d'embeddings, cache par processus de 6 h), requête hybride avec filtres exacts (ET sur les facettes), puis **rechargement depuis PostgreSQL** : un produit retiré depuis la dernière synchronisation n'apparaît jamais, et les facettes demandées sont revérifiées. Provider en erreur ou désactivé : mots-clés seuls.
- **Catalogue public** (`GET /:locale/products?search=…`) : Meilisearch pour une recherche par terme ; la navigation sans terme (catégories, tri par prix) reste servie par PostgreSQL. Meilisearch inerte ou injoignable : repli sur la recherche PostgreSQL, avec un `warn`.
- **Sélecteur de produit d'une demande de devis** : mots-clés seuls (aucun appel au provider d'embeddings à chaque frappe), repli `lookupForRfq`.
- **`SEARCH_SEMANTIC_RATIO`** (optionnelle, défaut 0,5) : poids du sémantique dans la requête hybride.
- **Jeu de requêtes de référence** (12 requêtes : mots-clés, multilingue, fautes de frappe, ET, sémantique) et **`node ace search:evaluate [--reindex]`** : rappel@10 et latences p50 / p95 par le vrai chemin de recherche. Sert à choisir modèle, ratio et quantification par la mesure.
- **CI** : job `test-search` avec un vrai Meilisearch, qui rejoue les requêtes non sémantiques.
- Détail : [`docs/search.md`](../search.md). Suite : PR 2b (texte vectorisé, `embedMany`, choix du modèle), PR 3 (retrait du `tsvector` et du HNSW, traductions).
