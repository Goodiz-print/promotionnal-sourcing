# Recherche (Meilisearch)

Moteur de recherche hybride (mots-clés + vecteurs) des produits, décidé par l'[ADR 0002](adr/0002-recherche-meilisearch-hybride.md) (#112). **Cette première étape ne fait qu'alimenter l'index** : la recherche de l'application (catalogue public, sélecteur de produit des demandes de devis) reste sur PostgreSQL jusqu'à la bascule.

## Principe

- **PostgreSQL est la source de vérité.** Meilisearch est un index de lecture qu'on peut jeter et reconstruire.
- **Rien n'est écrit dans Meilisearch depuis une requête HTTP** : toute écriture qui change l'index met un job en queue.
- **Le document est reconstruit depuis la base à chaque passage**, jamais depuis un état mémorisé : synchroniser deux fois, dans le désordre ou après un échec donne le même index.
- **Sans `MEILISEARCH_HOST`, tout est inerte** (dev, test, CI) : `NullSearchEngine` est lié, aucun job n'est mis en queue, aucune connexion n'est tentée.

## Configuration

| Variable              | Rôle                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------- |
| `MEILISEARCH_HOST`    | URL de l'instance (ex. `http://localhost:7700`). Absente = indexation désactivée.       |
| `MEILISEARCH_API_KEY` | Clé autorisant l'écriture dans l'index (clé master ou clé dédiée). Jamais dans l'image. |

`config/search.ts` : `index` = `products_<NODE_ENV>` (un Meilisearch partagé entre environnements ne mélange pas leurs fiches), `batchSize` (500), `taskTimeoutMs`. Instance locale : `docker compose up -d` (voir `docs/deploiement.md`).

## Document d'index (`ProductSearchDocument`)

`id`, `slug`, `reference`, `categoryId`, `supplierId`, `madeInEurope`, `originCountry`, `attributeValueIds` (facettes), `names` et `descriptions` **par langue de contenu** (`names.fr`, `names.en`…), et `_vectors.default` (le vecteur de `products.embedding`, calculé par `EmbeddingService` avec le provider configuré, `mistral-embed` par défaut ; `null` tant que le produit n'est pas vectorisé).

Réglages (`PRODUCT_INDEX_SETTINGS`) : attributs cherchables `names`, `descriptions`, `reference` — un seul attribut par famille couvre toutes les langues, **ajouter une langue ne change aucun réglage** ; attributs filtrables `categoryId`, `supplierId`, `madeInEurope`, `originCountry`, `attributeValueIds` ; embedder `default` en `userProvided`, 1024 dimensions (les vecteurs viennent de l'application).

Seuls les produits **visibles** sont indexés : actifs, organisation non archivée ni rejetée, non rejetés par la modération — les mêmes scopes que la fiche publique (`Product.fromLiveOrganization`, `Product.notRejected`).

## Qui déclenche une synchronisation

| Écriture                                                                   | Événement                      | Job                            |
| -------------------------------------------------------------------------- | ------------------------------ | ------------------------------ |
| Création, mise à jour, suppression d'un produit (`SupplierProductService`) | `ProductChanged`               | `IndexProductJob`              |
| Traduction automatique d'un produit (`TranslationService`)                 | `ProductChanged`               | `IndexProductJob`              |
| Embedding calculé (`GenerateProductEmbeddingJob`)                          | `ProductChanged`               | `IndexProductJob`              |
| Décision de modération sur un produit (`ModerationService`)                | `ProductChanged`               | `IndexProductJob`              |
| Décision de modération sur une organisation                                | `OrganizationCatalogueChanged` | `IndexOrganizationProductsJob` |
| Archivage d'une organisation (`OrganizationService#archive`)               | `OrganizationCatalogueChanged` | `IndexOrganizationProductsJob` |

Les services émetteurs ne connaissent pas le moteur : ils émettent l'événement, `OnProductChanged` / `OnOrganizationCatalogueChanged` appellent `SearchSyncService`, qui met le job en queue (un échec de mise en queue est loggué sans être propagé : la base est à jour, la prochaine synchronisation ou `search:reindex` rattrape l'index). Les jobs importent `ProductIndexService` **dans `execute()`** (il charge le modèle `Product`) — voir la règle DI de `CLAUDE.md`.

## Réindexation complète

```bash
node ace search:reindex
```

Parcourt tous les produits par identifiant croissant, par lots (mémoire bornée), écrit dans un index temporaire `<index>_next` puis l'**échange atomiquement** avec l'index actif (`swap-indexes`) et supprime l'ancien. Les recherches ne voient jamais un index à moitié rempli ; un échec en route laisse l'ancien index en place et la commande peut être relancée. À lancer au premier déploiement de Meilisearch, après une perte de l'index, ou après une montée de version qui l'exige.

## Architecture

- `SearchEngine` (classe abstraite, jeton d'injection) → `MeilisearchEngine` ou `NullSearchEngine`, liés par `providers/search_provider.ts`.
- `ProductIndexService` : construit les documents, `sync`, `syncOrganization`, `reindexAll`.
- `SearchSyncService` : met les jobs en queue (no-op si désactivé).
- L'index et ses réglages sont garantis une fois par processus, au premier envoi (`createIndex` si absent, `updateSettings` sinon — idempotent).
- Une tâche Meilisearch en échec lève `SearchTaskFailedException` : le job est rejoué (5 tentatives).

## Connu, non traité (étapes suivantes de #112)

- **La recherche n'utilise pas encore l'index** : `ProductCatalogueService#list` et `#lookupForRfq` restent sur PostgreSQL. La bascule rechargera les produits retournés depuis la base (visibilité jugée par PostgreSQL).
- Suite de requêtes de référence (langues, fautes de frappe, multi-critères) et mesure de latence p95 à 1 M de produits.
- Retrait du `tsvector` par langue.
- Traductions des titres (32 langues) et des descriptions (à la première ouverture).
- Réindexation à la montée de version de Meilisearch, snapshots et supervision : voir `docs/deploiement.md`.

## Tests

- `tests/functional/search_indexing.spec.ts` : documents (noms par langue, facettes, vecteur), retrait des produits invisibles ou supprimés, idempotence, archivage et modération, réindexation par lots, déclencheurs — avec un moteur factice.
- `tests/unit/meilisearch_engine.spec.ts` : le pilote contre un `fetch` simulé (création de l'index et de ses réglages une seule fois, tâche en échec, reconstruction par index temporaire et échange).

Le pilote n'est pas testé contre un vrai Meilisearch en CI.
