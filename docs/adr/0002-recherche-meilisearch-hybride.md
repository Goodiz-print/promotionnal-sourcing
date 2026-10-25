# ADR 0002 : recherche hybride Meilisearch, vecteurs calculés par l'application

- **Statut** : proposé
- **Date** : 2026-10-25
- **Remplace** : ADR 0001 (recherche multi-critères sur PostgreSQL, sans moteur dédié)
- **Issues liées** : #112 (moteur hybride Meilisearch), #69 (benchmark, clos « not planned », à réorienter), #70 et #71 (pgvector, halfvec)

## Contexte

Le moteur de recherche est le point de différenciation du produit : une requête combinant plusieurs critères (« stylo à encre noire, Made in Europe ») doit renvoyer uniquement des produits qui satisfont tous les critères (ET exact, voir `docs/product-context.md`). Le catalogue vise environ 1 million de produits décrits dans jusqu'à 32 langues, saisis par des fournisseurs de toute l'Europe, et interrogés par des acheteurs qui ne parlent pas forcément la langue de la fiche.

L'ADR 0001 (15 octobre 2026) confiait tout à PostgreSQL : facettes en SQL, plein texte `tsvector` par langue, recherche sémantique pgvector. Le client a depuis validé Meilisearch en recherche hybride (#112), pour trois raisons : une requête dans une langue doit trouver une fiche décrite dans une autre ; ajouter une langue ne doit pas toucher au catalogue ; filtres, facettes et tolérance aux fautes doivent être natifs.

L'état du code au moment de cette décision :

- La vectorisation existe mais est désactivée par défaut (`AI_EMBEDDINGS_ENABLED`) et n'a jamais tourné sur de vrais embeddings. `EmbeddingService` calcule un vecteur par produit via une abstraction `EmbeddingProvider` (driver Mistral natif ou tout endpoint OpenAI-compatible), avec clé d'idempotence, et l'écrit dans `products.embedding` (`halfvec(1024)`, index HNSW).
- La recherche sémantique actuelle n'est pas hybride : dès qu'un vecteur de requête existe, le plein texte est abandonné et tout le catalogue vectorisé est trié par distance, sans seuil. Les filtres ET sont appliqués après le parcours de l'index HNSW (post-filtrage), ce qui peut renvoyer zéro résultat sur une requête sélective.
- Le texte vectorisé concatène toutes les traductions : chaque traduction automatique qui arrive change la clé d'idempotence et provoque un recalcul payant.
- Un appel API par produit, sans lot ; un appel synchrone par recherche, sans cache.
- Le plein texte par langue dépend de dictionnaires PostgreSQL que la base managée Clever Cloud ne fournit pas (`docs/deploiement.md`).

Le projet est porté par une seule personne, avec un budget d'infrastructure de 100 à 500 € par mois (ADR 0001, ADR 0003).

## Décision

**Meilisearch sert la recherche (mots-clés + vecteurs, filtres exacts). PostgreSQL reste la source de vérité. L'application calcule et conserve les vecteurs ; Meilisearch les reçoit tels quels.**

### 1. Répartition des rôles

| Rôle                                             | Où                                                             |
| ------------------------------------------------ | -------------------------------------------------------------- |
| Source de vérité (fiches, traductions, facettes) | PostgreSQL                                                     |
| Calcul des embeddings                            | Application (`EmbeddingService`, provider injecté)             |
| Conservation durable des vecteurs                | PostgreSQL (`products.embedding`), **sans index HNSW** à terme |
| Index de recherche, hybride, filtres, facettes   | Meilisearch (embedder `userProvided`)                          |
| Vecteur de la requête                            | Application (même provider que l'index), avec cache            |
| Règles de visibilité finales                     | PostgreSQL (rechargement des résultats)                        |

Meilisearch est un **index de lecture reconstructible**. Le perdre ne perd aucune donnée : une commande de réindexation le reconstruit depuis PostgreSQL, sans appel au provider d'embeddings puisque les vecteurs y sont conservés.

### 2. Le provider d'embeddings n'est pas imposé

**Mistral n'est pas une obligation.** Le contrat est l'abstraction `EmbeddingProvider` existante ; le modèle est un paramètre de configuration, choisi par la mesure, pas par l'architecture. Ce qui est figé :

- un **seul** modèle actif à la fois pour l'index et les requêtes (un vecteur de requête n'est comparable qu'à des vecteurs du même modèle) ;
- le nom du modèle, le provider et la dimension entrent dans la clé d'idempotence (déjà le cas) et dans le **nom de l'embedder Meilisearch** (ex. `mistral-embed-1024`), pour que changer de modèle soit un ré-embedding complet explicite, jamais un mélange ;
- la dimension devient une **configuration** (`AI_EMBED_DIMENSIONS`) et non plus une constante : la colonne PostgreSQL et l'embedder Meilisearch doivent la suivre par migration.

Candidats à comparer sur le jeu de requêtes de référence (section 7), dans cet ordre de préférence a priori :

| Modèle                                     | Accès                                                         | Pour                                                                                   | Contre                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `mistral-embed` (1024)                     | API Mistral, driver déjà écrit                                | Hébergeur européen (RGPD sans transfert), SDK en place, multilingue                    | Dimension fixe à vérifier (`output_dimension` non documenté pour ce modèle)               |
| `bge-m3` ou `multilingual-e5-large`        | Auto-hébergé (Ollama, vLLM, TEI) via driver OpenAI-compatible | Open-weight, 100+ langues, aucun coût par token, données qui ne sortent pas de l'infra | Un serveur GPU ou CPU à exploiter, en contradiction avec l'ADR 0003 (zéro administration) |
| `text-embedding-3-small` (1536 ou réduit)  | API OpenAI via driver OpenAI-compatible                       | Peu coûteux, dimension réductible                                                      | Données hors UE, à cadrer contractuellement                                               |
| `voyage-3` / `embed-multilingual` (Cohere) | API                                                           | Très bons scores multilingues rapportés                                                | Fournisseurs non européens, drivers à écrire ou à passer par l'API compatible             |

Le choix sera consigné dans le changelog de livraison de #112, avec les mesures. Tant qu'il n'est pas fait, `mistral-embed` reste la valeur par défaut de la configuration, parce que le driver existe et que le fournisseur est européen.

### 3. Texte vectorisé

Le texte envoyé au modèle est construit par `EmbeddingService.productText` et conçu pour la recherche, pas pour l'affichage :

1. nom dans la **langue source** de la fiche uniquement (les modèles retenus sont multilingues ; ne pas concaténer les traductions, qui rendent la clé instable et le texte long) ;
2. libellé de la catégorie (langue source) ;
3. libellés des facettes sous forme « attribut : valeur » (ex. « couleur : noir », « matière : coton », « grammage : 200 g/m² ») ;
4. début de la description (tronqué à une longueur fixe, ex. 1 000 caractères).

Toute modification de cette fonction est un changement de version du texte, intégré à la clé d'idempotence (`textVersion`), donc un ré-embedding complet assumé.

### 4. Document Meilisearch

Un document par produit, identifiant = `products.id`. Index unique `products`.

| Champ                                           | Rôle Meilisearch       | Remarque                                                                      |
| ----------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------- |
| `name.<locale>`, `description.<locale>`         | `searchableAttributes` | Une sous-clé par locale disponible ; réglage `localizedAttributes` par locale |
| `category.<locale>`, `supplier_name`            | `searchableAttributes` |                                                                               |
| `category_id`, `supplier_id`, `organization_id` | `filterableAttributes` |                                                                               |
| `made_in_europe`, `origin_country`              | `filterableAttributes` |                                                                               |
| `attribute_value_ids` (tableau d'entiers)       | `filterableAttributes` | ET exact : `attribute_value_ids = 12 AND attribute_value_ids = 34`            |
| `attributes.<slug>` (valeur canonique)          | `filterableAttributes` | Pour les facettes affichées et les attributs numériques (grammage, plage)     |
| `price_min`, `price_max`                        | `sortableAttributes`   |                                                                               |
| `is_visible`                                    | `filterableAttributes` | `is_active AND non rejeté AND organisation vivante`, toujours filtré à `true` |
| `_vectors.<embedder>`                           | vecteur `userProvided` | Copie de `products.embedding`                                                 |

Les filtres Meilisearch sont des pré-filtres exacts appliqués avant le classement : le ET multi-critères est garanti par l'index, comme il l'était par SQL. Les résultats sont ensuite **rechargés depuis PostgreSQL** par identifiant, dans l'ordre renvoyé, et les produits devenus invisibles entre-temps sont écartés. C'est la seconde garantie, et c'est ce que `docs/rfq.md` demande déjà pour le sélecteur de produit.

### 5. Requête

- L'application calcule le vecteur de la requête avec le provider actif, derrière un **cache** (clé = hachage de la requête normalisée + nom de l'embedder, durée de vie de quelques heures) pour ne pas payer un appel par page vue.
- Envoi à Meilisearch de `q` (mots-clés, tolérance aux fautes) et `hybrid.semanticRatio` avec le vecteur. Le ratio est un réglage mesuré sur le jeu de référence (point de départ : 0,5).
- Si le provider est indisponible ou désactivé : recherche **mots-clés seule** (`semanticRatio` 0). Jamais d'erreur utilisateur à cause de l'IA.
- Les deux recherches de l'application (catalogue public `ProductCatalogueService.list`, sélecteur RFQ `lookupForRfq`) passent par un même `ProductSearchService`, qui renvoie des identifiants ordonnés et le total.

### 6. Synchronisation PostgreSQL → Meilisearch

- Un seul job, `SyncProductSearchJob { productId }`, idempotent (upsert par identifiant, ou suppression si le produit n'existe plus ou n'est pas visible). Il est dispatché depuis **toute** cause de changement : sauvegarde fournisseur, import, arrivée d'une traduction automatique, modération, archivage ou réactivation d'une organisation, variantes et paliers de prix.
- Le job calcule l'embedding si nécessaire (clé d'idempotence inchangée = pas d'appel), l'écrit dans PostgreSQL, puis pousse le document. L'ordre garantit qu'une réindexation retrouve toujours le vecteur en base.
- `embedMany` par lots (50 à 100 textes par appel) pour l'import et le backfill.
- Commande `search:reindex` : lit PostgreSQL par lots de 1 000, pousse les documents, et ne rappelle le provider que pour les vecteurs manquants. Rejouable sans perte. Création de l'index et de ses réglages par une commande `search:setup` versionnée dans le code (jamais à la main).
- En cas d'échec Meilisearch, le job est rejoué par la queue (`maxRetries`) ; l'échec définitif est loggé et visible, et la réindexation rattrape.

### 7. Jeu de requêtes de référence

Avant de figer modèle et ratio, et à chaque changement du pipeline : 30 à 50 requêtes versionnées dans `tests/search/` (plusieurs langues, fautes de frappe, synonymes, multi-critères avec filtres), chacune avec ses fiches attendues sur le seed `full`. Mesure du rappel@10 et de la latence. C'est le critère d'acceptation « requête multilingue et requête avec faute » de #112.

### 8. Dimensionnement et quantification

À 1 million de produits en 1024 dimensions `float32`, les vecteurs seuls pèsent environ 4 Go, plus l'index. L'instance Docker M (4 Go) de l'ADR 0003 est insuffisante. Deux leviers, à mesurer :

- **quantification binaire** Meilisearch (`binaryQuantized`) : mémoire divisée par 32. Irréversible, et la documentation signale une perte de qualité sensible sous 512 dimensions et minime au-delà de 1 500 ; à 1 024 l'effet doit être mesuré sur le jeu de référence avant activation ;
- instance plus grande (8 à 16 Go, estimation de #112).

Côté PostgreSQL, les vecteurs restent (environ 2 Go en `halfvec`) mais l'index HNSW (environ 1 Go et sa RAM) est supprimé une fois Meilisearch en service.

### 9. Ce qui disparaît

- `products_embedding_idx` (HNSW) et le tri par distance dans `ProductCatalogueService.list`.
- `product_translations.search_vector`, `ProductTranslationSearchService`, les index GIN par locale et l'entrée de `schema_rules.ts`, **après** la bascule en production, par une nouvelle migration (jamais en modifiant une migration exécutée).
- La règle « ajouter une langue = une entrée `LOCALE_TSCONFIG` + une migration » ; ajouter une langue devient une sous-clé de plus dans le document Meilisearch.
- Le repli full-text PostgreSQL : le repli devient « Meilisearch mots-clés seuls ». Si Meilisearch est indisponible, la recherche l'est aussi (page d'erreur explicite) ; c'est accepté, le catalogue par navigation (catégories, fiches) reste servi par PostgreSQL.

## Alternatives écartées

| Option                                                          | Raison du rejet                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rester sur PostgreSQL seul (ADR 0001) en corrigeant le pipeline | Il faudrait construire soi-même la fusion mots-clés + vecteurs (RRF), la tolérance aux fautes (`pg_trgm`), le scan itératif HNSW, et contourner l'absence de dictionnaires sur la base managée. Meilisearch fournit les trois nativement ; c'est ce qui paie la seconde source de données.                 |
| Laisser Meilisearch calculer les embeddings (embedder `rest`)   | Plus simple à brancher, mais l'application perd l'idempotence, le lot, le cache de requête et le choix libre du provider ; chaque réindexation complète rappelle l'API (environ 20 $ et des heures), et un changement de modèle impose de tout refaire sans copie. Les vecteurs en base évitent tout cela. |
| Vecteurs uniquement dans Meilisearch (sans copie PostgreSQL)    | Réindexation = ré-embedding complet. Une panne d'index ou un changement de version Meilisearch qui exige une réindexation coûte alors en API et en temps.                                                                                                                                                  |
| Un document par traduction                                      | Multiplie les documents par le nombre de langues, duplique les vecteurs et les facettes, et complique la déduplication des résultats. Un document par produit avec des sous-clés par locale suffit, le modèle d'embedding étant multilingue.                                                               |
| Typesense, OpenSearch, Qdrant/Weaviate + plein texte à côté     | Même coût de synchronisation que Meilisearch avec, soit une exploitation plus lourde pour une personne seule, soit deux moteurs à combiner (vecteurs d'un côté, mots-clés de l'autre).                                                                                                                     |

## Conséquences

**Positives**

- Recherche multilingue, tolérante aux fautes et hybride sans dictionnaire ni index par langue.
- ET exact garanti deux fois (filtres Meilisearch, puis rechargement PostgreSQL).
- Modèle d'embeddings remplaçable par configuration et ré-embedding explicite ; aucune dépendance architecturale à Mistral.
- Réindexation complète gratuite en appels IA, parce que les vecteurs vivent en base.
- Allègement de PostgreSQL (index HNSW et GIN retirés).

**Négatives**

- Deuxième système à exploiter : versions Meilisearch épinglées, snapshots, volume persistant (point à valider de l'ADR 0003).
- Latence de synchronisation : un produit modifié est cherchable après le passage du job, pas dans la transaction.
- Une indisponibilité de Meilisearch rend la recherche indisponible.
- Coût d'embedding initial (quelques dizaines d'euros pour 1 M de fiches) et à chaque changement de modèle ou de version du texte vectorisé.

## Plan de livraison (#112)

1. `start/env.ts` : `MEILISEARCH_HOST`, `MEILISEARCH_API_KEY`, `AI_EMBED_DIMENSIONS`. Client Meilisearch derrière une classe abstraite `SearchEngine` liée dans un provider (règle DI), fausse implémentation en mémoire pour les tests.
2. `search:setup` (réglages de l'index versionnés), `SyncProductSearchJob`, `embedMany`, `search:reindex`. Aucun écran ne change encore.
3. Jeu de requêtes de référence ; choix du modèle, du ratio et de la quantification par la mesure.
4. `ProductSearchService` branché sur le catalogue public et le sélecteur RFQ, cache des vecteurs de requête, repli mots-clés.
5. Mise en production, puis migration de retrait du HNSW et du `tsvector`.

## Critères de révision

- Latence p95 de recherche hybride avec trois filtres supérieure à 300 ms à 1 M de produits (seuil hérité de l'ADR 0001, à confirmer à l'étape 3).
- Rappel@10 sur le jeu de référence inférieur à celui de la recherche PostgreSQL actuelle sur les mêmes requêtes.
- Coût d'exploitation de Meilisearch (instance + temps) qui fait sortir du budget de l'ADR 0003.
- Écarts répétés entre l'index et la base que la réindexation ne suffit pas à résorber.
