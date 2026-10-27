# Moteur de recherche Elasticsearch (ADR 0004, PR 1)

> Date : 2026-10-27

`ElasticsearchEngine` implémente `SearchEngine` à côté de Meilisearch, qui reste en place jusqu'à la bascule (PR 3). Aucun contrôleur, job ni service de recherche ne change.

- **Sélection du moteur** (`providers/search_provider.ts`, `config/search.ts`) : `ELASTICSEARCH_URL` défini → Elasticsearch ; sinon `MEILISEARCH_HOST` → Meilisearch ; sinon `NullSearchEngine`. Variables `ELASTICSEARCH_URL`, `ELASTICSEARCH_USER`, `ELASTICSEARCH_PASSWORD` (`start/env.ts`, `.env.example`).
- **Index** : `products_<env>` est un **alias** vers un index concret horodaté. `search:reindex` construit un nouvel index puis bascule l'alias atomiquement et supprime l'ancien ; un échec laisse l'alias sur l'ancien index. Le mapping est immuable : le changer passe par `search:reindex`.
- **Mapping** : `names.<locale>` / `descriptions.<locale>` avec un analyzer par langue (`french`, `english`, `standard` pour les autres) ; facettes `attributes.<slug>` créées à la volée (`double`), sans liste de slugs à synchroniser.
- **Requêtes** : filtres exacts en `filter` (une clause par valeur de facette : le ET), provenance en OU, nouveautés en intervalle, éco ; texte `multi_match` avec `fuzziness: AUTO`. Hybride : retriever `linear` (BM25 pondéré `1 − ratio`, sémantique `ratio`, scores `minmax`) ; l'embedder coupé ou une requête vide donnent du BM25 seul. Distributions de facettes par agrégations `terms`.
- **Embeddings** : avec `AI_PROVIDER=mistral` et `MISTRAL_API_KEY`, l'application crée (une fois) l'endpoint d'inférence `embeddings_<env>` dans le cluster ; Elasticsearch vectorise `embeddingText` (champ `semantic_text`) et la requête. Autre provider avec Elasticsearch : embeddings coupés (mots-clés seuls).
- **Développement local** : `docker compose --profile elasticsearch up -d` (nœud unique, sécurité coupée, licence d'essai).
- **Tests** : `tests/unit/elasticsearch_engine.spec.ts` (16 cas) — construction des filtres et du corps de requête, mapping, création de l'index et de l'alias, inférence, erreurs de lot, suppression idempotente, facettes, reconstruction atomique et interrompue, sur un client factice.
- **Hypothèses non vérifiées** (à lever en PR 2 sur un vrai cluster) : version de l'add-on ≥ 8.18 (retriever `linear`), licence couvrant `semantic_text` et l'inférence, accès sortant vers l'API Mistral. Le CI `test-search` contre un vrai Elasticsearch et `search:evaluate` sont l'objet de la PR 2.
