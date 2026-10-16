# Recherche sémantique : embeddings Mistral (Phase 1)

> Date : 2026-07-11

Ajoute la génération d'**embeddings produits via Mistral** et la **recherche
sémantique** du catalogue (plus proches voisins pgvector), en complément du
full-text existant. Clôt le volet « recherche sémantique » de la Phase 1 (#20,
suivi de #2, coordonné avec #7).

- **Config** `config/ai.ts` (Mistral `mistral-embed`, 1024 dims) + env
  `MISTRAL_API_KEY` (optionnel) et `AI_EMBEDDINGS_ENABLED` (bool, **défaut
  faux**). Désactivé en dev/test/CI → **aucun appel réseau** ; activé en prod.
- **Service** `embedding_service.ts` : `embed(text)` (client Mistral injecté →
  testable), `embedAndStore(product)` (persiste `products.embedding` en
  `?::vector`), `productText(product)` (nom + description, toutes locales).
  Helper `shared/helpers/pgvector.ts` (`toPgVector`).
- **Job** `app/jobs/generate_product_embedding_job.ts` (alias `#jobs/*`) :
  dispatché à la création/mise à jour d'un produit fournisseur
  (`supplier_product_service`, dispatch résilient). No-op tant que l'IA est
  désactivée.
- **Recherche** : `product_catalogue_service.list` accepte un `queryEmbedding`
  optionnel → tri par distance cosinus (`embedding <=> ?::vector`, index HNSW)
  parmi les produits vectorisés ; repli automatique sur le full-text si l'IA est
  indisponible. `products_controller` calcule l'embedding de la requête
  (best-effort) quand l'IA est active.
- **Backfill** : commande `node ace embeddings:backfill` (embeddings manquants).
- **Tests** : `tests/unit/embedding_service.spec.ts` (Mistral mocké, zéro
  réseau) + `tests/functional/product_embeddings.spec.ts` (tri sémantique +
  repli FTS, gardés Postgres/pgvector).
- **Docs** : `docs/catalogue.md` (section « Recherche sémantique »).
