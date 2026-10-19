# `products.embedding` passe en `halfvec(1024)`

> Date : 2026-10-17

Évaluation (#71) : `halfvec` divise par ~2 le stockage (4,1 Ko → 2 Ko par embedding) et l'index HNSW (~3× plus petit mesuré), sans écart de distance significatif. Migration `products_embedding_halfvec` (colonne + index `halfvec_cosine_ops`, `down()` réversible). Les écritures et la recherche sémantique castent en `?::halfvec`. Mesures et limites dans `docs/catalogue.md` (« Décision halfvec »).
