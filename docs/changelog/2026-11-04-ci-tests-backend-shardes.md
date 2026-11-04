# Tests backend shardés en CI

> Date : 2026-11-04

Le job `test-backend` de `.github/workflows/ci.yml` est désormais une matrice de 5 jobs parallèles :

- `unit` (1 job) ;
- `functional` (4 shards).

Les fichiers `*.spec.ts` de la suite sont triés puis répartis en round-robin (`awk`), chaque fichier étant passé à `node ace test <suite> --files=<fichier>`. Chaque job dispose de son propre service PostgreSQL (la suite tronque les tables : aucune base partagée entre shards). `fail-fast: false` pour voir tous les échecs.

Les jobs `test-search*` (Meilisearch) sont inchangés. Les checks s'appellent maintenant `test-backend (functional 1/4)`, etc. : adapter les règles de protection de branche si `test-backend` y est requis.
