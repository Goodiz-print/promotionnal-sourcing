# PostgreSQL : version cible alignée (local, tests, CI) (#87)

> Date : 2026-10-16

Dev local, base de test et CI tournent tous sur `pgvector/pgvector:pg18` (18.6 relevée).
Aucune migration modifiée. Détail, extensions requises (`vector` 0.8.7, `pg_trgm`,
`unaccent`), configurations FTS disponibles et checklist de bascule : `docs/postgres.md`.
Suite backend vérifiée sur 18.6 (identique à pg16 : un échec préexistant sans lien avec
PostgreSQL).
