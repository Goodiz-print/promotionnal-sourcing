# Recherche (Meilisearch)

Moteur de recherche hybride (mots-clés + vecteurs) des produits, décidé par l'[ADR 0002](adr/0002-recherche-meilisearch-hybride.md) (#112). Le catalogue public (recherche par terme) et le sélecteur de produit des demandes de devis interrogent Meilisearch quand il est disponible ; la navigation sans terme (catégories, filtres, tri par prix) reste servie par PostgreSQL. Il n'y a plus de repli de recherche sur PostgreSQL : moteur indisponible, la recherche l'est aussi, avec un message explicite.

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

`id`, `slug`, `reference`, `categoryId`, `supplierId`, `madeInEurope`, `originCountry`, `originZone` (provenance dérivée, voir « Provenance et Nouveautés »), `releasedAt` (date de sortie en **timestamp Unix secondes**, ou `null`), `isEco` (filtre « Éco-responsable » dérivé, voir « Conformité »), `attributeValueIds` (facettes, toutes valeurs confondues), `certificationIds` (labels de conformité, voir « Certifications »), `attributes` (facettes **aplaties par slug** : `attributes.color`, `attributes.color-shade`, `attributes.material`… — voir ci-dessous), `names` et `descriptions` **par langue de contenu** (`names.fr`, `names.en`…), et `embeddingText` (le texte que Meilisearch vectorise : voir « Vectorisation »).

Réglages (`productIndexSettings(facetSlugs)`) : attributs cherchables `names`, `descriptions`, `reference` — un seul attribut par famille couvre toutes les langues, **ajouter une langue ne change aucun réglage** ; attributs filtrables `categoryId`, `supplierId`, `madeInEurope`, `originCountry`, `originZone`, `releasedAt`, `isEco`, `attributeValueIds`, `certificationIds`, **plus un champ `attributes.<slug>` par attribut filtrable** (`facetSlugs` dérivés de `category_attributes.is_filter`, via `FilterableFacetsService` — jamais une liste codée en dur) ; embedder `default` (voir « Vectorisation »), retiré des réglages quand il est coupé. Les réglages sont réappliqués au premier envoi d'un processus et à chaque `search:reindex` : un changement de `is_filter` est donc pris en compte au prochain reindex.

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

Ces champs sont déclarés `filterableAttributes` (donc facettables) à partir de
`FilterableFacetsService.filterableSlugs()` (les slugs `category_attributes.is_filter`,
distincts et triés). `SearchEngine.facetDistribution({ query, filter, facets })`
renvoie alors les **distributions de facettes** (compteurs par valeur) de
Meilisearch (`search` avec `facets` et `limit: 0`).

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
**backfill** est `node ace search:reindex` (réapplique les réglages — dont les
`attributes.<slug>` filtrables dérivés de la base — et réécrit tous les
documents avec leur objet `attributes`). Frontend : `inertia/pages/products/index.vue`,
`inertia/components/catalogue_filters.vue` + `inertia/components/catalogue/facet_group.vue`
(pastille hex des couleurs, compteurs, tranches numériques).

### Provenance et Nouveautés — ÉTAPE 2 du modèle produit (écarts 9 et 5)

Deux facettes de fiche s'ajoutent aux réglages `filterableAttributes` :

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
  (`(originZone = 'france' OR originZone = 'europe')`), groupées pour rester en ET
  avec les autres critères.
- **`releasedAt`** (filtre « Nouveautés », écart 5) : date de sortie en timestamp
  Unix (secondes). Le filtre est un intervalle `releasedAt >= <seuil>`, le seuil
  étant « il y a `NEW_PRODUCT_WINDOW_DAYS` jours » (90). `null` = pas de date,
  jamais une nouveauté.

Côté catalogue, ces deux filtres transitent par `ProductDirectoryFilters`
(`originZones: OriginZone[]`, `newOnly: boolean`) : avec terme de recherche ils
passent au moteur (`buildProductFilter`) **et** sont revérifiés sur PostgreSQL au
rechargement ; sans terme, `ProductCatalogueService.list` applique les mêmes
clauses directement en base. **Backfill** : `node ace search:reindex` recalcule et
réécrit `origin_zone` puis republie tous les documents avec `originZone` /
`releasedAt`. Frontend : cases France/Europe/Hors Europe et bascule « Nouveautés »
dans `inertia/components/catalogue_filters.vue`.

### Conformité — ÉTAPE 3 du modèle produit (écart 4)

Une facette de fiche s'ajoute aux réglages `filterableAttributes` :

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
  (`isEco = true`), jamais une négation : ne pas cocher la case ne filtre rien.

Côté catalogue, ce filtre transite par `ProductDirectoryFilters` (`ecoOnly:
boolean`) : avec terme de recherche il passe au moteur (`buildProductFilter`) **et**
est revérifié sur PostgreSQL au rechargement ; sans terme,
`ProductCatalogueService.list` applique la même clause directement en base.
**Backfill** : `node ace search:reindex` recalcule et réécrit `is_eco` puis
republie tous les documents. Frontend : case « Éco-responsable » dans
`inertia/components/catalogue_filters.vue`. Les **certifications**, elles, sont
depuis l'ÉTAPE 6 une **facette filtrable** à part entière (voir « Certifications »
ci-dessous).

### Certifications — ÉTAPE 6 du modèle produit (écart 4)

Une facette de fiche s'ajoute aux réglages `filterableAttributes` :

- **`certificationIds`** : identifiants des labels de conformité du produit
  (pivot `product_certifications`). **Donnée directe**, jamais dérivée : remplie
  par `ProductIndexService.toDocument` depuis `product.certifications` (déjà
  préchargé). Champ **plat** (pas sous `attributes.<slug>`) car les certifications
  sont **transverses aux catégories**, contrairement aux attributs EAV
  (dépendants de la catégorie). Le filtre est un **ET exact** comme
  `attributeValueIds` (une clause `certificationIds = X` par label coché), cohérent
  avec le différenciateur « filtres multi-critères fiables en ET logique ».

Côté catalogue, ce filtre transite par `ProductDirectoryFilters`
(`certificationIds: number[]`) : avec terme de recherche il passe au moteur
(`buildProductFilter`) **et** est revérifié sur PostgreSQL au rechargement ; sans
terme, `ProductCatalogueService.list` applique les mêmes clauses M2M directement
en base. La **barre de filtres certifications** est **globale** (transverse aux
catégories) : assemblée par `CatalogueCertificationFacetService` et exposée par le
contrôleur **sans catégorie sélectionnée**, elle part du référentiel fermé
(`certifications`) enrichi des compteurs de `facetDistribution` sur
`certificationIds`. **Backfill** : aucun (donnée directe) — `node ace search:reindex`
réapplique les réglages et réécrit `certificationIds` pour peupler la facette.
Frontend : cases groupées par domaine dans
`inertia/components/catalogue/certification_facet.vue`.

## Vectorisation (embedder de Meilisearch)

**Meilisearch calcule lui-même les vecteurs** (ADR 0002, décision 3), à partir du champ `embeddingText` de chaque document (`documentTemplate: '{{ doc.embeddingText }}'`) à l'indexation, et du texte `q` à la recherche. L'application ne fait aucun appel à un modèle d'embeddings, n'a pas de copie des vecteurs en base et ne gère ni lots ni rejeux d'embeddings.

| `AI_PROVIDER`              | Embedder Meilisearch | Où tourne le modèle                                             | Clé                           |
| -------------------------- | -------------------- | --------------------------------------------------------------- | ----------------------------- |
| `huggingface` (**défaut**) | `huggingFace`        | Dans Meilisearch (modèle téléchargé)                            | Aucune                        |
| `mistral`                  | `rest`               | API Mistral                                                     | `MISTRAL_API_KEY`             |
| `openai-compatible`        | `rest`               | Endpoint OpenAI `/embeddings` (OpenAI, Together, Ollama, vLLM…) | `AI_API_KEY` ou `AI_BASE_URL` |

- **Modèle par défaut** : `intfloat/multilingual-e5-base` (multilingue, 768 dimensions, ~1 Go), modifiable par `HF_EMBED_MODEL` (`MISTRAL_EMBED_MODEL`, `AI_EMBED_MODEL` pour les autres providers). C'est un point de départ, à trancher par `search:evaluate`.
- **Texte vectorisé** (`ProductIndexService.embeddingText`) : nom dans la **langue source**, catégorie, facettes « attribut : valeur », début de description (300 caractères). Une seule langue : le modèle est multilingue, et concaténer les traductions ferait changer le texte à chaque traduction automatique.
- **Activation** (`config/search.ts`, `embedder`) : **active par défaut** (le provider `huggingface` n'a rien à configurer). `AI_EMBEDDINGS_ENABLED=false` la coupe (mots-clés seuls) ; `=true` avec un provider API sans identifiants échoue au démarrage ; en `NODE_ENV=test`, coupée sauf demande explicite. Coupée, elle est retirée des réglages de l'index.
- **Les réglages sont appliqués à la création de l'index** : activer, couper ou changer d'embedder ou de modèle se fait par `node ace search:reindex` (index temporaire créé avec les nouveaux réglages, puis échangé).
- **Coût** : la reconstruction complète recalcule tous les vecteurs — du temps de calcul sur l'instance Meilisearch avec `huggingface`, ~20 $ pour 1 M de fiches avec `mistral-embed` (à confirmer). Les mises à jour de fiches ne recalculent que si le texte vectorisé change.
- **Premier usage avec `huggingface`** : Meilisearch télécharge le modèle (~1 Go) depuis Hugging Face ; la première tâche d'indexation est longue (délai d'attente : 10 minutes). L'instance doit joindre Hugging Face en sortie (cf. `docs/deploiement.md`).
- **Embedder indisponible** (API en panne ou limitée, modèle pas encore chargé) : à l'indexation, la tâche Meilisearch échoue → `SearchTaskFailedException`, le job est rejoué ; à la recherche, la requête est rejouée en mots-clés seuls.
- **Latence** : la requête est vectorisée par Meilisearch à chaque recherche hybride (sur son CPU avec `huggingface`) ; à mesurer par `search:evaluate`. Le sélecteur de produit des demandes de devis reste par mots-clés pour ne pas payer ce calcul à chaque frappe.

⚠️ **Jamais exécuté contre un vrai modèle en local** (pas de Docker ici). Le job CI `test-search-semantic` fait tourner Meilisearch avec l'embedder `huggingface` et rejoue les requêtes sémantiques ; tant qu'il n'est pas vert, le support du modèle par Meilisearch et la qualité sur le seed restent à confirmer. À valider ensuite en préproduction sur de vraies fiches multilingues. Les modèles e5 recommandent des préfixes `query:` / `passage:` que Meilisearch n'ajoute pas côté requête : on n'en met d'aucun côté.

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

`search:evaluate` rejoue chaque requête **à travers le vrai chemin** (`ProductSearchService`, rechargement PostgreSQL compris) et affiche verdict, rappel@10 et latence par requête, puis le rappel moyen et les latences p50 / p95 ; code de sortie 1 si une requête échoue. C'est l'outil qui sert à **choisir par la mesure** le modèle d'embeddings, `SEARCH_SEMANTIC_RATIO` et la quantification (ADR 0002, décisions 3, 7 et 10) : changer l'un d'eux, relancer, comparer.

En CI, le job `test-search` démarre un vrai Meilisearch et rejoue les requêtes non sémantiques ; `test-search-semantic` y ajoute l'embedder `huggingface` et rejoue aussi les requêtes sémantiques (`tests/functional/search_reference.spec.ts`). `pnpm test` ignore ce fichier faute de `MEILISEARCH_HOST`.

⚠️ Le seed ne contient que du français et de l'anglais, sur six fiches : il éprouve le pipeline (mots-clés, fautes, ET, rechargement, et le sémantique en CI) mais **pas la qualité multilingue du modèle**. Avant de figer le modèle, étendre le jeu avec de vraies fiches dans plusieurs langues.

## Connu, non traité (étapes suivantes de #112)

- **Embedder à valider en conditions réelles** : voir l'avertissement de « Vectorisation » (support du modèle, débit d'indexation, mémoire de l'instance).
- **Choix du modèle, du ratio et de la quantification** : à faire avec des vecteurs réels (les valeurs par défaut — `mistral-embed`, 0,5, pas de quantification — sont celles de l'ADR).
- **Mesure de latence p95 à 1 M de produits** : `search:evaluate` la mesure sur l'index courant ; il reste à l'exécuter sur un catalogue de cette taille.
- **Traductions** (ADR 0002, décision 12) : titres traduits à l'import, descriptions à la première ouverture par langue — PR dédiée.
- Le `tsvector` par langue, le HNSW et les colonnes d'embeddings ont été retirés (migration `…drop_postgres_search_columns`, PR 3).
- Réindexation à la montée de version de Meilisearch, snapshots et supervision : voir `docs/deploiement.md`.

## Tests

- `tests/functional/search_indexing.spec.ts` : documents (noms par langue, facettes `attributeValueIds`, **facettes aplaties par slug** avec couleur famille déduite de la nuance, texte vectorisé), retrait des produits invisibles ou supprimés, idempotence, archivage et modération, réindexation par lots, déclencheurs — avec un moteur factice.
- `tests/unit/meilisearch_engine.spec.ts` : le pilote contre un `fetch` simulé (création de l'index et de ses réglages une seule fois, tâche en échec, reconstruction par index temporaire et échange, requête hybride et filtre ET, **distributions de facettes** — `facets` + `limit: 0` + lecture de `facetDistribution` —, configuration de l'embedder `rest`).
- `tests/functional/catalogue_facet_bar.spec.ts` : dérivation des slugs filtrables depuis `category_attributes.is_filter` (`FilterableFacetsService`) ; barre de filtres par catégorie (`CatalogueFacetBarService`) — attributs résolus (propres + hérités), facettes demandées au moteur, fusion des compteurs, repli sans compteur (moteur inerte ou injoignable).
- `tests/functional/catalogue_certification_facet.spec.ts` : barre de filtres certifications (`CatalogueCertificationFacetService`) — référentiel exposé, fusion des compteurs (`facetDistribution` sur `certificationIds`), cadrage excluant les labels cochés, repli sans compteur (moteur inerte ou injoignable).
- `tests/functional/catalogue_certifications.spec.ts` : filtrage du catalogue par certification (écart 4, ÉTAPE 6) — sous-ensemble, ET sur plusieurs labels, combinaison avec un autre critère, transmission au moteur et revérification au rechargement PostgreSQL.
- `tests/functional/product_search.spec.ts` : rechargement depuis PostgreSQL (ordre, visibilité, facettes revérifiées), requête transmise au moteur, ratio sémantique et repli par mots-clés si l'API d'embeddings tombe, écrans (catalogue, sélecteur, message « recherche indisponible »).
- `tests/unit/product_origin_service.spec.ts` : dérivation `origin_zone` (France, Europe UE/EEE ou `madeInEurope`, autre, inconnue → `null`).
- `tests/functional/product_identity_commercial.spec.ts` : persistance des champs d'identité/commercial/médias, dérivation et recalcul d'`origin_zone`, filtres provenance (OU) et « Nouveautés » du catalogue.
- `tests/unit/search_evaluation.spec.ts` : verdict, rappel, percentiles.
- `tests/functional/search_reference.spec.ts` : le jeu de référence contre un vrai Meilisearch (job CI `test-search`).

Le pilote est testé contre un vrai Meilisearch par le jeu de référence en CI (`test-search`) ; en local, le lancer avec `docker compose up -d` puis `MEILISEARCH_HOST=http://localhost:7700 MEILISEARCH_API_KEY=… node ace test functional --files=tests/functional/search_reference.spec.ts`.
