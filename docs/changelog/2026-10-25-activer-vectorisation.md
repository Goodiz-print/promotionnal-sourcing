# Vectorisation par Meilisearch, activée dès que le provider est configuré (#112)

> Date : 2026-10-25

Les embeddings ne sont plus calculés par l'application : **Meilisearch les calcule lui-même** (embedder `rest` appelant l'API d'embeddings, `mistral-embed` par défaut). ADR 0002 mis à jour en conséquence.

- **Embedder** : actif dès que le provider est configuré (`MISTRAL_API_KEY`, ou `AI_API_KEY` / `AI_BASE_URL` avec `AI_PROVIDER=openai-compatible`) ; coupé sans identifiants et en `NODE_ENV=test`. `AI_EMBEDDINGS_ENABLED=false` le coupe même avec une clé, `=true` sans identifiants échoue au démarrage. Coupé, il est retiré des réglages de l'index (mots-clés seuls). Activer, couper ou changer d'embedder = `node ace search:reindex`.
- **Texte vectorisé** (`embeddingText` de chaque document) : nom en langue source, catégorie, facettes « attribut : valeur », début de description (300 caractères).
- **Requêtes** : Meilisearch vectorise la requête (`hybrid.semanticRatio`, `SEARCH_SEMANTIC_RATIO`). API d'embeddings indisponible : la requête est rejouée en mots-clés seuls. Le sélecteur de produit des demandes de devis reste par mots-clés.
- **Supprimé** : `EmbeddingService`, les drivers d'embeddings (`app/services/embeddings/`), `GenerateProductEmbeddingJob`, `node ace embeddings:backfill`, le cache des vecteurs de requête, le tri par distance pgvector de `ProductCatalogueService#list`. Les colonnes `products.embedding` / `embedding_key` et l'index HNSW ne sont plus utilisés (suppression par migration en PR 3).
- **Procédure d'activation en production** : `docs/catalogue.md` (« Activer la vectorisation »). Coût : la reconstruction complète rappelle l'API pour tout le catalogue (~20 $ pour 1 M de fiches, à confirmer).
- ⚠️ La configuration de l'embedder n'a pas été exécutée contre une vraie API d'embeddings (pas de clé en CI) : à valider en préproduction.
- ⚠️ Une clé Mistral déjà présente dans l'environnement active l'embedder au prochain `search:reindex`.
