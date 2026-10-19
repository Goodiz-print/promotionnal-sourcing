# Version minimale de pgvector documentée (#107)

Date : 2026-10-18

- `docs/postgres.md` : pgvector **0.7 minimum** (type `halfvec`, migration `products_embedding_halfvec`), requête de vérification, environnements recommandés.
- Le conteneur `pgvector/pgvector:pg18` reste la voie recommandée en dev, tests et CI. Le paquet Debian 0.6.0 est explicitement déconseillé.
- Validation : le run CI `177` sur `d0a9184` (PostgreSQL 18, pgvector 0.8) est vert, dont les 4 tests d'embeddings que l'environnement local ne passait pas.
