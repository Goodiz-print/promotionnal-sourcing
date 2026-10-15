# ADR 0001 : recherche multi-critères sur PostgreSQL, sans moteur dédié

- **Statut** : accepté
- **Date** : 2026-10-15
- **Issues liées** : #69 (benchmark à 1 M de produits), #70 (pgvector), #71 (halfvec)

## Contexte

Le moteur de recherche est le point de différenciation du produit. Une recherche combinant plusieurs critères (« stylo à encre noire, Made in Europe ») doit renvoyer uniquement des produits qui satisfont tous les critères. C'est un ET exact, pas une pertinence approximative (voir `docs/product-context.md`).

Le catalogue vise environ 1 million de produits à 12-24 mois. Il combine :

- des facettes exactes (`product_attributes`, ET par relations SQL) ;
- un plein texte par langue (`tsvector`, `unaccent`, `pg_trgm`) ;
- une recherche sémantique (embeddings `mistral-embed`, 1024 dimensions, index HNSW pgvector) ;
- une recherche par image à la demande (vision puis embedding texte).

Le projet est porté par une seule personne, avec un budget d'infrastructure de 100 à 500 € par mois.

## Décision

**PostgreSQL est à la fois la source de vérité et le moteur de recherche en V1.** Le filtrage ET, le plein texte et la recherche sémantique s'exécutent dans la même base.

Aucun moteur dédié (Meilisearch, Typesense, OpenSearch) n'est ajouté pour la V1.

## Alternatives écartées

| Option | Raison du rejet en V1 |
| --- | --- |
| Meilisearch ou Typesense | Deuxième source de données à synchroniser (réindexation, écarts, échecs de queue). Coût en RAM et en exploitation supplémentaire. Le ET exact est déjà garanti par SQL. |
| OpenSearch ou Elasticsearch | Même problème de synchronisation, avec une charge d'exploitation nettement plus lourde pour une personne seule. |

## Conséquences

**Positives**
- Une seule source de vérité : pas de réindexation, pas de risque d'écart entre la base et l'index.
- Le ET reste exact et transactionnel, comme le demande le produit.
- Une seule facture d'infrastructure à maîtriser.

**Négatives**
- La tolérance aux fautes de frappe doit être construite avec `pg_trgm`, qui n'est pas encore utilisé.
- Les compteurs de facettes sont calculés en SQL. Leur coût à 1 M de produits est à mesurer.
- La base doit être dimensionnée pour les embeddings : estimation de 8 à 10 Go de RAM en `float32`, 4 à 5 Go en `halfvec` (#71). À confirmer par la mesure.

## Critères de révision

Cette décision est à revoir si l'un de ces points se produit :

1. Le benchmark (#69) ne tient pas le seuil proposé : latence p95 supérieure à 300 ms pour un ET sur trois facettes combiné à une recherche sémantique, à 1 M de produits. Ce seuil est à valider dans #69.
2. Le besoin de tolérance aux fautes dépasse ce que `pg_trgm` couvre.

**Plan de repli** : ajouter Meilisearch comme index de lecture seul, alimenté par la queue. PostgreSQL reste la source de vérité, et le ET continue d'être validé par la base.
