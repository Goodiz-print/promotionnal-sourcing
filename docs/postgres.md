# PostgreSQL — version cible

> Ticket : #87. Décision : on vise **la dernière version stable** de PostgreSQL au moment
> de la bascule en hébergement.

## État

| Environnement | Version                                              | Source                                                         |
| ------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| Dev local     | PostgreSQL 18 (`pgvector/pgvector:pg18`)             | `docker-compose.yml`, service `postgres`                       |
| Tests locaux  | PostgreSQL 18 (`pgvector/pgvector:pg18`), en `tmpfs` | `docker-compose.yml`, service `postgres_test` (`pnpm test:db`) |
| CI            | PostgreSQL 18 (`pgvector/pgvector:pg18`)             | `.github/workflows/ci.yml`, service `postgres`                 |
| Production    | à confirmer avec l'hébergeur (#80)                   | —                                                              |

Le tag `pg18` suit la dernière version mineure 18.x : un `docker compose pull` suffit pour
rester à jour. Dernière version relevée : **18.6** (août 2026). **Le numéro exact et la date
de bascule se confirment le jour J sur <https://www.postgresql.org/download/>.**

> Le volume de dev PostgreSQL 18 est monté sur `/var/lib/postgresql` (et non
> `/var/lib/postgresql/data`) : c'est le nouveau chemin attendu par l'image 18+. Un volume
> créé avec une image ≤ 17 n'est pas réutilisable tel quel (migration `pg_upgrade` ou
> `pg_dump` / restauration).

## Version minimale de pgvector (#107)

| Fonctionnalité                                | Version minimale de `vector` | Où                                                          |
| --------------------------------------------- | ---------------------------- | ----------------------------------------------------------- |
| Type `halfvec` (embeddings en demi-précision) | **0.7.0**                    | migration `…products_embedding_halfvec`, `EmbeddingService` |
| Index HNSW sur `halfvec`                      | 0.7.0                        | `products_embedding_idx`                                    |

**Ne pas utiliser une version inférieure à 0.7.** Avec 0.6.x, la migration échoue
(`type "halfvec" does not exist`) et quatre tests d'embeddings échouent.

Vérification sur une base :

```sql
SELECT extversion FROM pg_extension WHERE extname = 'vector';  -- doit être >= 0.7
```

Environnements :

- **Dev et tests** : `pgvector/pgvector:pg18` (`docker-compose.yml`), pgvector 0.8.x. C'est la voie recommandée.
- **CI** : même image (`.github/workflows/ci.yml`).
- **Installation manuelle** : le paquet Debian `postgresql-16-pgvector` de bookworm est en 0.6.0 et **ne convient pas**. Préférer le conteneur.

## Extensions requises (relevé sur 18.6)

| Extension  | Usage                                  | Version livrée |
| ---------- | -------------------------------------- | -------------- |
| `vector`   | embeddings produits (pgvector)         | 0.8.7          |
| `pg_trgm`  | recherche floue (typos)                | 1.6            |
| `unaccent` | normalisation des accents à la requête | 1.1            |

Activées par la migration `…948_enable_search_extensions.ts`. `pg_trgm` et `unaccent` sont
des modules `contrib` ; **`vector` n'est pas dans `contrib`** : c'est le point à faire
confirmer par l'hébergeur retenu (#80) avant la bascule.

## Configurations FTS disponibles (pour #84)

Relevé : `SELECT cfgname FROM pg_ts_config ORDER BY 1` sur 18.6 — **30 configurations** :
`arabic`, `armenian`, `basque`, `catalan`, `danish`, `dutch`, `english`, `estonian`,
`finnish`, `french`, `german`, `greek`, `hindi`, `hungarian`, `indonesian`, `irish`,
`italian`, `lithuanian`, `nepali`, `norwegian`, `portuguese`, `romanian`, `russian`,
`serbian`, `simple`, `spanish`, `swedish`, `tamil`, `turkish`, `yiddish`.

Dictionnaires : un `<langue>_stem` (Snowball) par configuration, plus `simple` et
`unaccent` (ce dernier est celui de l'extension, absent tant qu'elle n'est pas créée).

Configurations utilisées aujourd'hui par l'application (`LOCALE_TSCONFIG`,
`shared/types/i18n.ts`) : `fr → french`, `en → english`, repli `simple`.

## Vérification sur la version cible

```bash
docker compose --profile test pull postgres_test
docker rm -f promotionnal-sourcing-postgres-test   # base de test éphémère (tmpfs)
pnpm test:db && pnpm test
```

Résultat sur 18.6 : **209 tests passent, 1 échoue**. L'échec (`l'owner voit la liste des
catégories`, `Invalid command exported from "embeddings_backfill.js". Invalid URL`) est
**identique sur `pgvector/pgvector:pg16`** : il ne dépend pas de la version de PostgreSQL.
Aucune migration existante n'a été modifiée.

## Reste à faire (hors dépôt)

- [ ] Confirmer la version stable et la date de bascule (postgresql.org, le jour J).
- [ ] Faire confirmer `vector`, `pg_trgm`, `unaccent` par l'hébergeur retenu (#80).
- [ ] Tester la restauration d'une sauvegarde sur la version cible (#78).
- [ ] Mettre à jour le tableau des dictionnaires de #84 avec le relevé ci-dessus.
- [ ] Mettre à jour le ticket support Clever Cloud (ou Scaleway) avec la version cible.
