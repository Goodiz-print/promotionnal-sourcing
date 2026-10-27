# Retrait de Meilisearch : Elasticsearch seul moteur (ADR 0004, PR 2 et 3)

> Date : 2026-10-27

Elasticsearch remplace Meilisearch. Le moteur a été éprouvé sur un **vrai Elasticsearch 8.19.1** : le jeu de requêtes de référence passe (12 requêtes : mots-clés, multilingue, fautes, ET multi-critères), et la requête hybride (`copy_to` vers `semantic_text`, retriever `linear` avec filtres) a été validée avec un faux serveur d'embeddings compatible OpenAI.

- **Code retiré** : `MeilisearchEngine`, `tests/unit/meilisearch_engine.spec.ts`, la dépendance `meilisearch`, le service `meilisearch` et son volume du `docker-compose.yml`, les variables `MEILISEARCH_HOST`, `MEILISEARCH_API_KEY`, `MEILI_MASTER_KEY`, `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_EMBED_MODEL`, `HF_EMBED_MODEL`, ainsi que les providers d'embeddings `huggingface` et `openai-compatible` (`shared/types/search.ts`, `config/search.ts`).
- **Moteur** : `SearchEngine` est lié à `ElasticsearchEngine` quand `ELASTICSEARCH_URL` est défini, sinon à `NullSearchEngine`. Le service `elasticsearch` démarre avec `docker compose up -d` (et `pnpm dev:all`), sans profil.
- **Embeddings** : Mistral seulement, appelé par Elasticsearch (endpoint d'inférence). Actifs dès que `MISTRAL_API_KEY` est définie ; `AI_EMBEDDINGS_ENABLED=false` les coupe. `resolveEmbeddingsEnabled` ne prend plus de `provider`.
- **CI** : le job `test-search` démarre un service Elasticsearch 8.19.1 ; `test-search-semantic` est supprimé (le sémantique demande l'API Mistral et une clé).
- **Docs** : `docs/search.md`, `docs/deploiement.md`, `docs/catalogue.md`, `docs/rfq.md`, `docs/postgres.md`, `docs/queue.md`, `CLAUDE.md` ; ADR 0002 et 0003 renvoient à l'ADR 0004.
- **Non éprouvé** : l'endpoint d'inférence `mistral` contre la vraie API (clé, quota, accès sortant du cluster managé) et la qualité sémantique multilingue — à mesurer avec `AI_EMBEDDINGS_ENABLED=true node ace search:evaluate --reindex`. Le choix Elasticsearch M ou L attend ce test sur le cluster Clever Cloud (voucher de 250 €).
- **Reste** : `FilterableFacetsService` n'est plus utilisé par le moteur (les facettes sont mappées dynamiquement) ; candidat au retrait.
