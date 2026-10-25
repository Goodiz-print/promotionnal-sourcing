# Recherche (Meilisearch)

Moteur de recherche hybride (mots-clés + vecteurs) des produits, décidé par l'[ADR 0002](adr/0002-recherche-meilisearch-hybride.md) (#112). Le catalogue public (recherche par terme) et le sélecteur de produit des demandes de devis interrogent Meilisearch quand il est disponible ; la navigation sans terme et le repli restent sur PostgreSQL jusqu'au retrait de la PR 3.

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

`id`, `slug`, `reference`, `categoryId`, `supplierId`, `madeInEurope`, `originCountry`, `attributeValueIds` (facettes), `names` et `descriptions` **par langue de contenu** (`names.fr`, `names.en`…), et `embeddingText` (le texte que Meilisearch vectorise : voir « Vectorisation »).

Réglages (`productIndexSettings()`) : attributs cherchables `names`, `descriptions`, `reference` — un seul attribut par famille couvre toutes les langues, **ajouter une langue ne change aucun réglage** ; attributs filtrables `categoryId`, `supplierId`, `madeInEurope`, `originCountry`, `attributeValueIds` ; embedder `default` (voir « Vectorisation »), retiré des réglages quand il est coupé.

Seuls les produits **visibles** sont indexés : actifs, organisation non archivée ni rejetée, non rejetés par la modération — les mêmes scopes que la fiche publique (`Product.fromLiveOrganization`, `Product.notRejected`).

## Vectorisation (embedder de Meilisearch)

**Meilisearch calcule lui-même les vecteurs** (ADR 0002, décision 3). L'index déclare un embedder `rest` (`buildEmbedders`) qui appelle l'API d'embeddings — format OpenAI `/embeddings`, que Mistral partage — avec `documentTemplate: '{{ doc.embeddingText }}'` : à l'indexation il vectorise `embeddingText` de chaque fiche, à la recherche le texte `q`. L'application ne fait aucun appel au provider, n'a pas de copie des vecteurs en base et ne gère ni lots ni rejeux d'embeddings.

- **Texte vectorisé** (`ProductIndexService.embeddingText`) : nom dans la **langue source**, catégorie, facettes « attribut : valeur », début de description (300 caractères). Une seule langue : le modèle est multilingue, et concaténer les traductions ferait changer le texte à chaque traduction automatique.
- **Activation** (`config/search.ts`, `embedder`) : active dès que le provider est configuré (`MISTRAL_API_KEY`, ou `AI_API_KEY` / `AI_BASE_URL` avec `AI_PROVIDER=openai-compatible`) ; coupée sans identifiants et en `NODE_ENV=test` ; `AI_EMBEDDINGS_ENABLED=false` la coupe, `=true` sans identifiants échoue au démarrage. Coupée, elle est retirée des réglages : mots-clés seuls.
- **Réglages appliqués à la création de l'index** : activer, couper ou changer d'embedder se fait donc par `node ace search:reindex` (index temporaire créé avec les nouveaux réglages, puis échangé).
- **Coût** : la reconstruction complète rappelle l'API pour tout le catalogue (~20 $ pour 1 M de fiches avec `mistral-embed`, à confirmer). Les mises à jour de fiches ne coûtent que si le texte vectorisé change.
- **Panne de l'API d'embeddings** : à l'indexation, la tâche Meilisearch échoue → `SearchTaskFailedException`, le job est rejoué ; à la recherche, la requête est rejouée en mots-clés seuls.

⚠️ La configuration `rest` est celle de la documentation de Meilisearch pour les API de type OpenAI, mais **elle n'a pas été exécutée contre une vraie API d'embeddings** (la CI n'a pas de clé) : le premier `search:reindex` avec une clé en préproduction fera foi.

## Qui déclenche une synchronisation

| Écriture                                                                   | Événement                      | Job                            |
| -------------------------------------------------------------------------- | ------------------------------ | ------------------------------ |
| Création, mise à jour, suppression d'un produit (`SupplierProductService`) | `ProductChanged`               | `IndexProductJob`              |
| Traduction automatique d'un produit (`TranslationService`)                 | `ProductChanged`               | `IndexProductJob`              |
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

## Recherche (lecture)

`ProductSearchService` (`app/services/product_search_service.ts`) :

1. **Moteur** (`SearchEngine#search`) : `q`, filtres exacts `categoryId = … AND madeInEurope = true AND attributeValueIds = 3 AND attributeValueIds = 7` (une clause par valeur de facette : le ET), pagination `page` / `hitsPerPage`, et `hybrid: { embedder, semanticRatio }` quand l'embedder est actif et le ratio non nul — **Meilisearch vectorise `q`**. Renvoie des identifiants ordonnés et le total.
2. **Repli par mots-clés** : si la requête sémantique échoue (API d'embeddings indisponible ou limitée en débit), elle est rejouée avec `semanticRatio` 0 ; la recherche ne tombe jamais à cause de l'IA. Moteur injoignable même en mots-clés : `null`, l'appelant bascule sur PostgreSQL.
3. **Rechargement depuis PostgreSQL**, dans l'ordre du moteur : seuls les produits visibles (mêmes scopes que la fiche publique) sont gardés et **les facettes demandées sont revérifiées** — le ET est garanti deux fois. Un produit retiré depuis la dernière synchronisation n'apparaît jamais ; la page peut alors compter moins que `perPage`.

Branchement :

| Écran                                               | Méthode                                               | Repli si moteur inerte ou injoignable         |
| --------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------- |
| Catalogue public, avec terme (`ProductsController`) | `ProductSearchService#search` → paginateur            | `ProductCatalogueService#list` (full-text PG) |
| Catalogue public, sans terme                        | `ProductCatalogueService#list` (navigation, tri prix) | —                                             |
| Sélecteur de produit RFQ (`RfqsController`)         | `ProductSearchService#lookup` (mots-clés seuls)       | `ProductCatalogueService#lookupForRfq`        |

Les méthodes renvoient `null` quand la recherche est indisponible : l'appelant bascule sur PostgreSQL et la panne est loggée (`warn`). Ce repli disparaît avec la PR 3 de #112 ; il garde l'application utilisable pendant la transition.

## Jeu de requêtes de référence et mesure

`app/services/search/reference_queries.ts` : 12 requêtes versionnées sur le seed `full` — mots-clés, multilingue, fautes de frappe, ET multi-critères (dont un ET qui ne doit rien renvoyer) et requêtes sémantiques (ignorées sans vecteurs). `exact` exige le résultat exact (ni plus, ni moins) ; sinon le rappel@10 compte.

```bash
node ace db:seed                      # seed « full »
node ace search:evaluate --reindex    # reconstruit l'index puis mesure
```

`search:evaluate` rejoue chaque requête **à travers le vrai chemin** (`ProductSearchService`, rechargement PostgreSQL compris) et affiche verdict, rappel@10 et latence par requête, puis le rappel moyen et les latences p50 / p95 ; code de sortie 1 si une requête échoue. C'est l'outil qui sert à **choisir par la mesure** le modèle d'embeddings, `SEARCH_SEMANTIC_RATIO` et la quantification (ADR 0002, décisions 3, 7 et 10) : changer l'un d'eux, relancer, comparer.

En CI, le job `test-search` démarre un vrai Meilisearch et rejoue les requêtes non sémantiques (`tests/functional/search_reference.spec.ts`) ; `pnpm test` ignore ce fichier faute de `MEILISEARCH_HOST`.

⚠️ Le seed ne contient que du français et de l'anglais, et la CI n'a pas de clé d'embeddings : il éprouve le pipeline (mots-clés, fautes, ET, rechargement) mais **pas la qualité multilingue du modèle**. Avant de figer le modèle, étendre le jeu avec de vraies fiches dans plusieurs langues et activer l'embedder.

## Connu, non traité (étapes suivantes de #112)

- **Embedder jamais exécuté contre une vraie API** : voir l'avertissement de « Vectorisation ». À valider avec une clé en préproduction.
- **Choix du modèle, du ratio et de la quantification** : à faire avec des vecteurs réels (les valeurs par défaut — `mistral-embed`, 0,5, pas de quantification — sont celles de l'ADR).
- **Mesure de latence p95 à 1 M de produits** : `search:evaluate` la mesure sur l'index courant ; il reste à l'exécuter sur un catalogue de cette taille.
- Retrait du `tsvector` par langue et du HNSW, traductions (PR 3).
- Suppression des colonnes `products.embedding` / `embedding_key` et de l'index HNSW devenus inutiles (migration, PR 3).
- Réindexation à la montée de version de Meilisearch, snapshots et supervision : voir `docs/deploiement.md`.

## Tests

- `tests/functional/search_indexing.spec.ts` : documents (noms par langue, facettes, texte vectorisé), retrait des produits invisibles ou supprimés, idempotence, archivage et modération, réindexation par lots, déclencheurs — avec un moteur factice.
- `tests/unit/meilisearch_engine.spec.ts` : le pilote contre un `fetch` simulé (création de l'index et de ses réglages une seule fois, tâche en échec, reconstruction par index temporaire et échange, requête hybride et filtre ET, configuration de l'embedder `rest`).
- `tests/functional/product_search.spec.ts` : rechargement depuis PostgreSQL (ordre, visibilité, facettes revérifiées), requête transmise au moteur, ratio sémantique et repli par mots-clés si l'API d'embeddings tombe, écrans (catalogue, sélecteur).
- `tests/unit/search_evaluation.spec.ts` : verdict, rappel, percentiles.
- `tests/functional/search_reference.spec.ts` : le jeu de référence contre un vrai Meilisearch (job CI `test-search`).

Le pilote est testé contre un vrai Meilisearch par le jeu de référence en CI (`test-search`) ; en local, le lancer avec `docker compose up -d` puis `MEILISEARCH_HOST=http://localhost:7700 MEILISEARCH_API_KEY=… node ace test functional --files=tests/functional/search_reference.spec.ts`.
