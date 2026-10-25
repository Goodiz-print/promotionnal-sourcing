# Vectorisation par Meilisearch, active par défaut avec un modèle local (#112)

> Date : 2026-10-25

Les embeddings ne sont plus calculés par l'application : **Meilisearch les calcule lui-même**, par défaut avec un modèle multilingue qu'il fait tourner lui-même — **aucune clé API**. ADR 0002 mis à jour en conséquence.

- **Providers** (`AI_PROVIDER`) : `huggingface` (**défaut**, embedder `huggingFace`, modèle `intfloat/multilingual-e5-base`, `HF_EMBED_MODEL` pour en changer), `mistral` (API Mistral, `MISTRAL_API_KEY`), `openai-compatible` (OpenAI, Together, Ollama, vLLM…, `AI_API_KEY` / `AI_BASE_URL`).
- **Activation** : active par défaut ; `AI_EMBEDDINGS_ENABLED=false` la coupe (retire l'embedder des réglages, mots-clés seuls) ; `=true` avec un provider API sans identifiants échoue au démarrage ; coupée en `NODE_ENV=test` sauf demande explicite. Activer, couper ou changer d'embedder ou de modèle = `node ace search:reindex`.
- **Texte vectorisé** (`embeddingText` de chaque document) : nom en langue source, catégorie, facettes « attribut : valeur », début de description (300 caractères).
- **Requêtes** : Meilisearch vectorise la requête (`hybrid.semanticRatio`, `SEARCH_SEMANTIC_RATIO`). Embedder indisponible : la requête est rejouée en mots-clés seuls. Le sélecteur de produit des demandes de devis reste par mots-clés.
- **Supprimé** : `EmbeddingService`, les drivers d'embeddings (`app/services/embeddings/`), `GenerateProductEmbeddingJob`, `node ace embeddings:backfill`, le cache des vecteurs de requête, le tri pgvector de `ProductCatalogueService#list`. Les colonnes `products.embedding` / `embedding_key` et l'index HNSW ne sont plus utilisés (suppression par migration en PR 3).
- **Jeu de référence** : `rank` par requête (une requête sémantique sur six fiches doit placer les bonnes dans les premières, pas dans les dix premières) ; requêtes sémantiques rejouées par le nouveau job CI `test-search-semantic` (Meilisearch + modèle `huggingface`).
- **À savoir** : le premier `search:reindex` télécharge le modèle (~1 Go) et calcule sur le CPU de Meilisearch ; l'instance Docker M de l'ADR 0003 sera probablement trop juste (`docs/deploiement.md`).
- ⚠️ Non exécuté en local (pas de Docker) : support du modèle par Meilisearch, débit d'indexation et qualité sur de vraies fiches à valider (CI sémantique, puis préproduction).
