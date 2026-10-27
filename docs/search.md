# Recherche (Elasticsearch)

Moteur de recherche hybride (mots-clés + vecteurs) des produits, décidé par l'[ADR 0002](adr/0002-recherche-meilisearch-hybride.md) (#112) puis porté sur **Elasticsearch managé** par l'[ADR 0004](adr/0004-recherche-elasticsearch-manage.md). Le catalogue public (recherche par terme) et le sélecteur de produit des demandes de devis l'interrogent quand il est disponible ; la navigation sans terme (catégories, filtres, tri par prix) reste servie par PostgreSQL. Il n'y a pas de repli de recherche sur PostgreSQL : moteur indisponible, la recherche l'est aussi, avec un message explicite.

## Principe

- **PostgreSQL est la source de vérité.** Elasticsearch est un index de lecture qu'on peut jeter et reconstruire.
- **Rien n'est écrit dans Elasticsearch depuis une requête HTTP** : toute écriture qui change l'index met un job en queue.
- **Le document est reconstruit depuis la base à chaque passage**, jamais depuis un état mémorisé : synchroniser deux fois, dans le désordre ou après un échec donne le même index.
- **Sans `ELASTICSEARCH_URL`, tout est inerte** (dev, test, CI) : `NullSearchEngine` est lié, aucun job n'est mis en queue, aucune connexion n'est tentée.

## Configuration

| Variable                 | Rôle                                                                           |
| ------------------------ | ------------------------------------------------------------------------------ |
| `ELASTICSEARCH_URL`      | URL du cluster (ex. `http://localhost:9200`). Absente = indexation désactivée. |
| `ELASTICSEARCH_USER`     | Utilisateur (facultatif en local, sécurité coupée).                            |
| `ELASTICSEARCH_PASSWORD` | Mot de passe. Jamais dans l'image.                                             |
| `MISTRAL_API_KEY`        | Active les embeddings (voir « Vectorisation »).                                |

`config/search.ts` : `index` = `products_<NODE_ENV>` (un cluster partagé entre environnements ne mélange pas leurs fiches), `batchSize` (500), `taskTimeoutMs`. Cluster local : `docker compose up -d` (voir `docs/deploiement.md`).

## Document d'index (`ProductSearchDocument`)

`id`, `slug`, `reference`, `categoryId`, `supplierId`, `madeInEurope`, `originCountry`, `originZone` (provenance dérivée, voir « Provenance et Nouveautés »), `releasedAt` (date de sortie en **timestamp Unix secondes**, ou `null`), `isEco` (filtre « Éco-responsable » dérivé, voir « Conformité »), `attributeValueIds` (facettes, toutes valeurs confondues), `attributes` (facettes **aplaties par slug** : `attributes.color`, `attributes.color-shade`, `attributes.material`… — voir ci-dessous), `names` et `descriptions` **par langue de contenu** (`names.fr`, `names.en`…), et `embeddingText` (le texte qu'Elasticsearch vectorise : voir « Vectorisation »).

Mapping (`buildIndexDefinition`, `app/services/search/elasticsearch_engine.ts`) : `names.<locale>` et `descriptions.<locale>` sont des champs texte avec l'analyzer de leur langue (`french`, `english` ; `standard` pour toute langue sans analyzer dédié) ; la recherche couvre toutes les langues d'un motif (`names.*`, `descriptions.*`, `reference`), donc **ajouter une langue ne change aucun réglage**. Les filtres (`categoryId`, `supplierId`, `madeInEurope`, `originCountry`, `originZone`, `releasedAt`, `isEco`, `attributeValueIds`) sont des champs exacts. Les facettes `attributes.<slug>` sont créées **à la volée** (`double`) par un gabarit dynamique : aucune liste de slugs à connaître ni à synchroniser (`FilterableFacetsService` n'est plus utilisé par le moteur). `embeddingText` est copié dans un champ `semantic_text` quand l'embedder est actif. **Le mapping est immuable** : le changer, ou activer/couper l'embedder, passe par `node ace search:reindex`.

Seuls les produits **visibles** sont indexés : actifs, organisation non archivée ni rejetée, non rejetés par la modération — les mêmes scopes que la fiche publique (`Product.fromLiveOrganization`, `Product.notRejected`).

### Facettes attributs (dont couleur N1/N2) — ÉTAPE 1 du modèle produit

`attributeValueIds` porte **toutes** les valeurs de facette d'un produit, sans
distinction d'attribut : la couleur **famille** (N1) et **nuance** (N2), la
matière, et les attributs propres aux catégories (voir `docs/catalogue.md`,
§ « Attributs filtrables par catégorie »). Le filtre `attributeValueIds = X AND
attributeValueIds = Y` exige donc **toutes** les valeurs cochées — le ET fiable
s'applique tel quel aux nouvelles facettes, sans changement du moteur. Le
**backfill** se fait par `node ace search:reindex` : les nouveaux identifiants de
valeur entrent dans l'index au passage, aucun nouveau champ n'est à déclarer.

### Facettes aplaties par slug et distributions (2e PR — livré)

En plus de `attributeValueIds`, chaque document porte un objet **aplati par slug
d'attribut** `attributes.<slug>` (`attributes.color`, `attributes.color-shade`,
`attributes.material`, `attributes.cap-panels`…), construit par
`ProductIndexService.flattenedFacets` :

- une valeur énumérée porte son **identifiant** (`attribute_values.id`) sous le
  slug de son attribut ;
- la couleur **famille** (N1) est émise sous `attributes.color` **même quand le
  produit ne porte qu'une nuance** (N2) : elle est dérivée du `parent_value_id`
  de la nuance ;
- un attribut numérique porte sa **valeur brute**.

Ces champs sont mappés automatiquement (gabarit dynamique `attributes.*`).
`SearchEngine.facetDistribution({ query, filter, facets })`
renvoie alors les **distributions de facettes** (compteurs par valeur) de
`facets` et `limit: 0`).

`CatalogueFacetBarService.forCategory(categoryId, locale, { search, madeInEurope })`
assemble la **barre de filtres dépendante de la catégorie** : les attributs
filtrables résolus par `CatalogueFacetsService.resolveFilters` (propres +
hérités des ancêtres) enrichis des compteurs. Sans catégorie, la barre
d'attributs est vide ; moteur de recherche inerte ou injoignable, les attributs
sont renvoyés sans compteur (`hasCounts: false`, `count: null`). La distribution
est cadrée par la catégorie (+ terme de recherche et made-in-Europe), **sans**
les valeurs déjà cochées — un attribut déjà filtré garde ainsi des compteurs non
nuls sur ses autres valeurs.

Cette PR **n'ajoute pas** de comportement de filtrage : le ET multi-critères
(dont couleur N1/N2) fonctionne déjà via `attributeValueIds` (ci-dessus). Le
**backfill** est `node ace search:reindex` (reconstruit l'index et réécrit tous les
documents avec leur objet `attributes`). Frontend : `inertia/pages/products/index.vue`,
`inertia/components/catalogue_filters.vue` + `inertia/components/catalogue/facet_group.vue`
(pastille hex des couleurs, compteurs, tranches numériques).

### Provenance et Nouveautés — ÉTAPE 2 du modèle produit (écarts 9 et 5)

Deux facettes de fiche s'ajoutent au mapping :

- **`originZone`** (provenance à 3 états, écart 9) : `france` / `europe` / `other`,
  ou `null` quand l'origine est inconnue (exclue des cases France/Europe). C'est
  une colonne **dérivée** (`products.origin_zone`), jamais saisie : calculée par
  `ProductOriginService.deriveZone(originCountry, madeInEurope)` (France si `FR`,
  Europe si pays ∈ UE/EEE ou `made_in_europe`, autre si pays connu hors Europe,
  `null` sinon — liste `EU_EEA_COUNTRY_CODES` dans `shared/types/country.ts`). Elle
  est **persistée au save produit** (`SupplierProductService`) et **rattrapée
  (backfill) au passage d'indexation** (`ProductIndexService.documentsFor` recale
  `origin_zone` sur la dérivation courante — idempotent, n'écrit que les lignes
  qui changent). Les zones cochées se combinent en **OU** dans le filtre
  (un seul `terms` sur `originZone`), en ET avec les autres critères.
- **`releasedAt`** (filtre « Nouveautés », écart 5) : date de sortie en timestamp
  Unix (secondes). Le filtre est un intervalle (`range`, `releasedAt >= <seuil>`), le seuil
  étant « il y a `NEW_PRODUCT_WINDOW_DAYS` jours » (90). `null` = pas de date,
  jamais une nouveauté.

Côté catalogue, ces deux filtres transitent par `ProductDirectoryFilters`
(`originZones: OriginZone[]`, `newOnly: boolean`) : avec terme de recherche ils
passent au moteur (`buildProductFilters`) **et** sont revérifiés sur PostgreSQL au
rechargement ; sans terme, `ProductCatalogueService.list` applique les mêmes
clauses directement en base. **Backfill** : `node ace search:reindex` recalcule et
réécrit `origin_zone` puis republie tous les documents avec `originZone` /
`releasedAt`. Frontend : cases France/Europe/Hors Europe et bascule « Nouveautés »
dans `inertia/components/catalogue_filters.vue`.

### Conformité — ÉTAPE 3 du modèle produit (écart 4)

Une facette de fiche s'ajoute au mapping :

- **`isEco`** (filtre « Éco-responsable ») : booléen **dérivé** (`products.is_eco`),
  jamais saisi. Calculé par `ProductEcoService.deriveIsEco` : vrai si
  `recycled_content_percent > 0`, **ou** le produit porte une matière
  éco-responsable (bio / recyclé / naturel — `ECO_MATERIAL_SLUGS` dans
  `shared/types/certification.ts`), **ou** au moins un label de conformité éco
  (`certifications.is_eco`). Comme `origin_zone`, il est **persisté au save
  produit** (`SupplierProductService.refreshIsEco`, après synchronisation des
  facettes et des labels) et **rattrapé (backfill) au passage d'indexation**
  (`ProductIndexService.documentsFor` recale `is_eco` sur la dérivation courante,
  en même temps qu'`origin_zone` — idempotent). Le filtre est une clause booléenne
  (`isEco: true`), jamais une négation : ne pas cocher la case ne filtre rien.

Côté catalogue, ce filtre transite par `ProductDirectoryFilters` (`ecoOnly:
boolean`) : avec terme de recherche il passe au moteur (`buildProductFilters`) **et**
est revérifié sur PostgreSQL au rechargement ; sans terme,
`ProductCatalogueService.list` applique la même clause directement en base.
**Backfill** : `node ace search:reindex` recalcule et réécrit `is_eco` puis
republie tous les documents. Frontend : case « Éco-responsable » dans
`inertia/components/catalogue_filters.vue`. Les **certifications** restent au
niveau produit (pivot `product_certifications`, affichées sur la fiche) mais ne
sont **pas** une facette filtrable du moteur à ce stade.

## Vectorisation (inférence Elasticsearch)

**Elasticsearch calcule lui-même les vecteurs** (ADR 0004, décision 3) : le champ `embeddingText` de chaque document est copié dans un champ `semantic_text`, et le texte `q` est vectorisé à la recherche. L'application ne fait aucun appel à un modèle d'embeddings, n'a pas de copie des vecteurs en base et ne gère ni lots ni rejeux d'embeddings. Le fournisseur est **Mistral** (`mistral-embed`, 1 024 dimensions) : Elasticsearch l'appelle par un **endpoint d'inférence** `embeddings_<NODE_ENV>` que l'application crée une fois dans le cluster (`ensureInference`, à la création de l'index ou de `search:reindex`) avec `MISTRAL_API_KEY`.

- **Texte vectorisé** (`ProductIndexService.embeddingText`) : nom dans la **langue source**, catégorie, facettes « attribut : valeur », début de description (300 caractères). Une seule langue : le modèle est multilingue, et concaténer les traductions ferait changer le texte à chaque traduction automatique.
- **Activation** (`config/search.ts`, `embedder`) : **active par défaut** dès que `MISTRAL_API_KEY` est définie. `AI_EMBEDDINGS_ENABLED=false` la coupe (mots-clés seuls) ; `=true` sans clé échoue au démarrage ; en `NODE_ENV=test`, coupée sauf demande explicite. Coupée, le champ `semantic_text` n'est pas créé.
- **Modèle** : `MISTRAL_EMBED_MODEL` (`mistral-embed` par défaut). Changer de modèle change les vecteurs : supprimer l'endpoint d'inférence puis `node ace search:reindex`, et rejouer `search:evaluate`.
- **Hybride** : un retriever `linear` pondère le score BM25 par `1 − ratio` et le score sémantique par `ratio` (`SEARCH_SEMANTIC_RATIO`, 0,5 par défaut), scores normalisés (`minmax`) ; les filtres s'appliquent aux deux branches. Sans embedder, ou sans mots-clés, la requête est du BM25 seul.
- **Coût** : la reconstruction complète recalcule tous les vecteurs, ~20 $ pour 1 M de fiches avec `mistral-embed` (à confirmer). Les mises à jour de fiches ne recalculent que si le texte vectorisé change (à confirmer à l'usage).
- **Embedder indisponible** (API en panne ou limitée) : à l'indexation, un lot en erreur → `SearchTaskFailedException`, le job est rejoué ; à la recherche, la requête est rejouée en mots-clés seuls.
- **Latence** : la requête est vectorisée par un appel à l'API à chaque recherche hybride ; à mesurer par `search:evaluate`. Le sélecteur de produit des demandes de devis reste par mots-clés pour ne pas payer cet appel à chaque frappe.

⚠️ **Le chemin sémantique n'a jamais tourné contre la vraie API Mistral.** Ce qui est vérifié sur un vrai Elasticsearch 8.19.1 : le mapping `semantic_text` avec `copy_to`, le retriever `linear` avec filtres et la tolérance aux fautes (essai avec un faux serveur d'embeddings compatible OpenAI) ; le jeu de référence non sémantique passe (12 requêtes). Reste à valider : l'endpoint d'inférence `mistral` (clé, quota, accès sortant du cluster), la qualité multilingue de `mistral-embed` et le ratio, avec une clé et de vraies fiches (`AI_EMBEDDINGS_ENABLED=true node ace search:evaluate --reindex`).

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

Parcourt tous les produits par identifiant croissant, par lots (mémoire bornée), écrit dans un nouvel index horodaté (`<index>_<timestamp>`) puis **bascule atomiquement l'alias** `products_<NODE_ENV>` sur lui (une seule requête `_aliases`) et supprime l'ancien. Les recherches ne voient jamais un index à moitié rempli ; un échec en route laisse l'ancien index en place et la commande peut être relancée. À lancer au premier déploiement, après une perte de l'index, après un changement de mapping ou de modèle d'embeddings, ou après une montée de version qui l'exige.

## Architecture

- `SearchEngine` (classe abstraite, jeton d'injection) → `ElasticsearchEngine` ou `NullSearchEngine`, liés par `providers/search_provider.ts`.
- `ProductIndexService` : construit les documents, `sync`, `syncOrganization`, `reindexAll`.
- `SearchSyncService` : met les jobs en queue (no-op si désactivé).
- L'index est garanti une fois par processus, au premier envoi : si l'alias n'existe pas, un index horodaté est créé avec son mapping et rattaché à l'alias.
- Un lot d'écriture en erreur lève `SearchTaskFailedException` : le job est rejoué (5 tentatives).

## Recherche (lecture)

`ProductSearchService` (`app/services/product_search_service.ts`) :

1. **Moteur** (`SearchEngine#search`) : `q`, filtres exacts en clauses `filter` (`categoryId`, `madeInEurope`, et **une clause `term` par valeur de facette** `attributeValueIds` : le ET), pagination `from` / `size`, et le retriever `linear` hybride quand l'embedder est actif et le ratio non nul — **Elasticsearch vectorise `q`**. Renvoie des identifiants ordonnés et le total.
2. **Repli par mots-clés** : si la requête sémantique échoue (API d'embeddings indisponible ou limitée en débit), elle est rejouée avec un ratio de 0 ; la recherche ne tombe jamais à cause de l'IA. Moteur injoignable même en mots-clés : `null`, l'appelant bascule sur PostgreSQL.
3. **Rechargement depuis PostgreSQL**, dans l'ordre du moteur : seuls les produits visibles (mêmes scopes que la fiche publique) sont gardés et **les facettes demandées sont revérifiées** — le ET est garanti deux fois. Un produit retiré depuis la dernière synchronisation n'apparaît jamais ; la page peut alors compter moins que `perPage`.

Branchement :

| Écran                                               | Méthode                                               | Moteur inerte ou injoignable                                     |
| --------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------- |
| Catalogue public, avec terme (`ProductsController`) | `ProductSearchService#search` → paginateur            | page « recherche indisponible » (`searchUnavailable`)            |
| Catalogue public, sans terme                        | `ProductCatalogueService#list` (navigation, tri prix) | inchangé (PostgreSQL)                                            |
| Sélecteur de produit RFQ (`RfqsController`)         | `ProductSearchService#lookup` (mots-clés seuls)       | `productResults: null` → « recherche indisponible » du sélecteur |

Les méthodes renvoient `null` quand la recherche est indisponible et la panne est loggée (`warn`). Aucune recherche de repli sur PostgreSQL (retirée avec la PR 3 de #112) ; seule la **navigation** reste servie par la base.

## Jeu de requêtes de référence et mesure

`app/services/search/reference_queries.ts` : 12 requêtes versionnées sur le seed `full` — mots-clés, multilingue, fautes de frappe, ET multi-critères (dont un ET qui ne doit rien renvoyer) et requêtes sémantiques (ignorées sans vecteurs). `rank: N` exige les fiches attendues aux `N` premières places (mots-clés, fautes, sémantique) ; `exact` exige le résultat exact (ni plus, ni moins) et n'est demandé qu'aux requêtes **à filtres** : une recherche hybride complète toujours la liste avec les voisins sémantiques, mais un filtre est strict.

```bash
node ace db:seed                      # seed « full »
node ace search:evaluate --reindex    # reconstruit l'index puis mesure
```

`search:evaluate` rejoue chaque requête **à travers le vrai chemin** (`ProductSearchService`, rechargement PostgreSQL compris) et affiche verdict, rappel@10 et latence par requête, puis le rappel moyen et les latences p50 / p95 ; code de sortie 1 si une requête échoue. C'est l'outil qui sert à **choisir par la mesure** le modèle d'embeddings, `SEARCH_SEMANTIC_RATIO`, la fuzziness et le dimensionnement M/L (ADR 0004) : changer l'un d'eux, relancer, comparer.

En CI, le job `test-search` démarre un vrai Elasticsearch et rejoue les requêtes non sémantiques (`tests/functional/search_reference.spec.ts`) ; les requêtes sémantiques demandent l'API Mistral et sont ignorées. `pnpm test` ignore ce fichier faute de `ELASTICSEARCH_URL`.

⚠️ Le seed ne contient que du français et de l'anglais, sur six fiches : il éprouve le pipeline (mots-clés, fautes, ET, rechargement) mais **ni le sémantique ni la qualité multilingue du modèle**. Avant de figer le modèle, étendre le jeu avec de vraies fiches dans plusieurs langues.

## Connu, non traité (étapes suivantes de #112)

- **Embeddings à valider en conditions réelles** : voir l'avertissement de « Vectorisation ».
- **Pertinence** : `fuzziness: AUTO`, `minimum_should_match: 2<75%`, poids `names^3` / `reference^2` et ratio sont des points de départ, à régler par `search:evaluate` sur de vraies fiches multilingues.
- **Analyzers** : seules `fr` et `en` ont un analyzer dédié (`CONTENT_LOCALES`) ; ajouter une langue de contenu demande d'ajouter son analyzer à `LOCALE_ANALYZERS`, sinon `standard`.
- **Total de résultats** : avec le retriever hybride, le total est borné par la fenêtre de classement (`rank_window_size`, au moins 100 et `from + size`).
- **Mesure de latence p95 à 300 000 puis 1 M de produits**, et choix M ou L : `search:evaluate` sur le cluster de test (voucher Clever Cloud).
- **Traductions** (ADR 0002, décision 12) : titres traduits à l'import, descriptions à la première ouverture par langue — PR dédiée.
- Supervision, snapshots et montées de version de l'add-on : voir `docs/deploiement.md`.

## Tests

- `tests/functional/search_indexing.spec.ts` : documents (noms par langue, facettes `attributeValueIds`, **facettes aplaties par slug** avec couleur famille déduite de la nuance, texte vectorisé), retrait des produits invisibles ou supprimés, idempotence, archivage et modération, réindexation par lots, déclencheurs — avec un moteur factice.
- `tests/unit/elasticsearch_engine.spec.ts` : le pilote contre un client factice (filtres ET, provenance, nouveautés, corps hybride `linear`, mapping, création de l'index et de l'alias une seule fois, endpoint d'inférence, lot en erreur, suppression idempotente, **distributions de facettes** par agrégations, reconstruction atomique et interrompue).
- `tests/functional/catalogue_facet_bar.spec.ts` : dérivation des slugs filtrables depuis `category_attributes.is_filter` (`FilterableFacetsService`) ; barre de filtres par catégorie (`CatalogueFacetBarService`) — attributs résolus (propres + hérités), facettes demandées au moteur, fusion des compteurs, repli sans compteur (moteur inerte ou injoignable).
- `tests/functional/product_search.spec.ts` : rechargement depuis PostgreSQL (ordre, visibilité, facettes revérifiées), requête transmise au moteur, ratio sémantique et repli par mots-clés si l'API d'embeddings tombe, écrans (catalogue, sélecteur, message « recherche indisponible »).
- `tests/unit/product_origin_service.spec.ts` : dérivation `origin_zone` (France, Europe UE/EEE ou `madeInEurope`, autre, inconnue → `null`).
- `tests/functional/product_identity_commercial.spec.ts` : persistance des champs d'identité/commercial/médias, dérivation et recalcul d'`origin_zone`, filtres provenance (OU) et « Nouveautés » du catalogue.
- `tests/unit/search_evaluation.spec.ts` : verdict, rappel, percentiles.
- `tests/functional/search_reference.spec.ts` : le jeu de référence contre un vrai Elasticsearch (job CI `test-search`).

Le pilote est testé contre un vrai Elasticsearch par le jeu de référence en CI (`test-search`) ; en local, le lancer avec `docker compose up -d` puis `ELASTICSEARCH_URL=http://localhost:9200 node ace test functional --files=tests/functional/search_reference.spec.ts`.
