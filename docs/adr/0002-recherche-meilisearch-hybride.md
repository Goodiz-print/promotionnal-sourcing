# ADR 0002 : recherche hybride Meilisearch, vecteurs calculés par l'application

- **Statut** : proposé (à valider par le titulaire du projet)
- **Date** : 2026-10-25
- **Issues liées** : #112 (migration vers Meilisearch) ; #69, #70, #71 (benchmark et pgvector de l'ADR 0001, à réorienter ou fermer)
- **Remplace** : [ADR 0001](0001-recherche-postgresql.md)

## Contexte

Le moteur de recherche est le point de différenciation du produit : une requête combinant plusieurs critères (« stylo à encre noire, Made in Europe ») doit renvoyer uniquement des produits qui satisfont tous les critères (ET exact, voir `docs/product-context.md`). Le catalogue vise environ 1 million de produits décrits dans jusqu'à 32 langues, saisis par des fournisseurs de toute l'Europe et interrogés par des acheteurs qui ne parlent pas forcément la langue de la fiche.

L'ADR 0001 (15 octobre 2026) gardait la recherche dans PostgreSQL : ET exact par relations SQL, plein texte par langue (`tsvector`), recherche sémantique (pgvector). Le client a validé un autre choix, **Meilisearch en recherche hybride** (mots-clés + vecteurs multilingues), pour trois raisons :

- l'empreinte vectorielle d'une fiche ne dépend pas de la langue : une requête dans une langue trouve une fiche décrite dans une autre ;
- pas de dictionnaire ni d'index par langue : ajouter une langue ne touche pas au catalogue ;
- filtres, facettes et tolérance aux fautes natifs.

L'ADR 0001 prévoyait ce cas comme plan de repli : _Meilisearch comme index de lecture seul, alimenté par la queue, PostgreSQL restant la source de vérité_. C'est la décision ci-dessous.

État du pipeline de vectorisation au moment de la décision, qui motive plusieurs points :

- La vectorisation existe mais est désactivée par défaut (`AI_EMBEDDINGS_ENABLED`) et n'a jamais tourné sur de vrais embeddings. `EmbeddingService` calcule un vecteur par produit via l'abstraction `EmbeddingProvider` (driver Mistral natif ou tout endpoint OpenAI-compatible), avec clé d'idempotence, et l'écrit dans `products.embedding` (`halfvec(1024)`, index HNSW).
- La recherche sémantique PostgreSQL n'est pas hybride : dès qu'un vecteur de requête existe, le plein texte est abandonné et tout le catalogue vectorisé est trié par distance, sans seuil. Les filtres ET sont appliqués après le parcours de l'index HNSW (post-filtrage), ce qui peut renvoyer zéro résultat sur une requête sélective.
- Le texte vectorisé concatène toutes les traductions : chaque traduction automatique qui arrive change la clé d'idempotence et provoque un recalcul payant.
- Un appel API par produit, sans lot ; un appel synchrone par recherche, sans cache.
- Le plein texte par langue dépend de dictionnaires PostgreSQL que la base managée Clever Cloud ne fournit pas (`docs/deploiement.md`).

Le projet est porté par une seule personne, avec un budget d'infrastructure de 100 à 500 € par mois (ADR 0001, ADR 0003).

## Décision

**Meilisearch sert la recherche (mots-clés + vecteurs, filtres exacts). PostgreSQL reste la source de vérité. L'application calcule et conserve les vecteurs ; Meilisearch les reçoit tels quels.**

| Rôle                                             | Où                                                                      |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| Source de vérité (fiches, traductions, facettes) | PostgreSQL                                                              |
| Calcul des embeddings                            | Application (`EmbeddingService`, provider injecté)                      |
| Conservation durable des vecteurs                | PostgreSQL (`products.embedding`), **sans index HNSW** après la bascule |
| Index de recherche, hybride, filtres, facettes   | Meilisearch (embedder `userProvided`)                                   |
| Vecteur de la requête                            | Application (même provider que l'index), avec cache                     |
| Règles de visibilité finales                     | PostgreSQL (rechargement des résultats)                                 |

### 1. PostgreSQL reste la source de vérité

Meilisearch est un **index de lecture**, jamais écrit autrement que depuis la base. Un index perdu ou corrompu se reconstruit par `node ace search:reindex`, sans perte et **sans appel au provider d'embeddings**, puisque les vecteurs sont conservés dans `products.embedding`.

### 2. Synchronisation par la queue, jamais dans la requête HTTP

Toute écriture qui change ce que l'index doit contenir (création, mise à jour, suppression, traduction, vecteur, modération, archivage) émet un événement (`ProductChanged`, `OrganizationCatalogueChanged`) ; son listener met en queue `IndexProductJob` (ou `IndexOrganizationProductsJob`). Le job **reconstruit le document depuis la base** à chaque exécution : il est idempotent, sûr dans le désordre (le dernier passage reflète l'état courant) et rejouable après échec (5 tentatives). Un échec de mise en queue est loggé sans être propagé : la base est à jour, la prochaine synchronisation ou `search:reindex` rattrape.

### 3. Vecteurs fournis par l'application, provider non imposé

Les vecteurs sont calculés par `EmbeddingService` (clé d'idempotence, gestion du coût) et poussés dans l'embedder Meilisearch `userProvided` (`SEARCH_EMBEDDER`, dimension `SEARCH_EMBEDDING_DIMENSIONS`). On ne confie pas à Meilisearch l'appel à l'API d'embeddings : un seul endroit appelle le fournisseur d'IA, et les vecteurs restent en base pour la réindexation.

**Mistral n'est pas une obligation.** Le contrat est l'abstraction `EmbeddingProvider` ; le modèle est un paramètre de configuration, choisi par la mesure sur le jeu de requêtes de référence (décision 8), pas par l'architecture. Ce qui est figé :

- un **seul** modèle actif à la fois pour l'index et les requêtes (un vecteur de requête n'est comparable qu'à des vecteurs du même modèle) ;
- le provider, le modèle et la dimension entrent dans la clé d'idempotence (déjà le cas) : changer de modèle provoque un recalcul complet des vecteurs puis un `search:reindex`, jamais un mélange ;
- la dimension de l'embedder Meilisearch et celle de la colonne PostgreSQL sont la même constante ; un modèle d'une autre dimension impose une migration de la colonne et une mise à jour des réglages de l'index.

Candidats à comparer, par ordre de préférence a priori :

| Modèle                                    | Accès                                                         | Pour                                                                                   | Contre                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `mistral-embed` (1024)                    | API Mistral, driver déjà écrit                                | Hébergeur européen (RGPD sans transfert), SDK en place, multilingue                    | Dimension fixe à vérifier (`output_dimension` non documenté pour ce modèle)               |
| `bge-m3`, `multilingual-e5-large`         | Auto-hébergé (Ollama, vLLM, TEI) via driver OpenAI-compatible | Open-weight, 100+ langues, aucun coût par token, données qui ne sortent pas de l'infra | Un serveur GPU ou CPU à exploiter, en contradiction avec l'ADR 0003 (zéro administration) |
| `text-embedding-3-small` (1536 ou réduit) | API OpenAI via driver OpenAI-compatible                       | Peu coûteux, dimension réductible                                                      | Données hors UE, à cadrer contractuellement                                               |
| `voyage-3`, `embed-multilingual` (Cohere) | API                                                           | Très bons scores multilingues rapportés                                                | Fournisseurs non européens, drivers à écrire ou API compatible à vérifier                 |

Tant que la mesure n'est pas faite, `mistral-embed` reste la valeur par défaut de la configuration : le driver existe et le fournisseur est européen.

### 4. Texte vectorisé

Le texte envoyé au modèle (`EmbeddingService.productText`) est conçu pour la recherche, pas pour l'affichage :

1. nom dans la **langue source** de la fiche uniquement (les modèles retenus sont multilingues ; ne pas concaténer les traductions, qui rendent la clé instable et le texte long) ;
2. libellé de la catégorie (langue source) ;
3. libellés des facettes sous forme « attribut : valeur » (« couleur : noir », « matière : coton », « grammage : 200 g/m² ») ;
4. début de la description, tronqué à une longueur fixe.

Toute modification de cette fonction est un changement de version du texte, intégré à la clé d'idempotence (`textVersion`), donc un ré-embedding complet assumé. `embedMany` par lots (50 à 100 textes par appel) pour l'import et le backfill.

### 5. Visibilité jugée par PostgreSQL à la lecture

Seuls les produits visibles (actifs, organisation vivante, non rejetés) sont indexés, mais un index est toujours en retard d'un instant : les produits retournés par Meilisearch sont **rechargés depuis PostgreSQL**, dans l'ordre renvoyé, et ceux qui ne sont plus visibles sont écartés. Un retard de synchronisation ne peut jamais exposer un produit retiré.

### 6. Filtre ET

Les filtres Meilisearch sur des identifiants (`attributeValueIds = 3 AND attributeValueIds = 7`, catégorie, pays, Made in Europe) sont des **pré-filtres booléens exacts**, appliqués avant le classement : ils garantissent le ET dans le moteur, comme SQL le garantissait. La base **revérifie** les facettes sur les produits rechargés (au plus une page) ; la suite de requêtes de référence tranche si cette revérification reste nécessaire.

### 7. Requête hybride

- L'application calcule le vecteur de la requête avec le provider actif, derrière un **cache** (clé = hachage de la requête normalisée + provider + modèle, durée de vie de quelques heures) pour ne pas payer un appel par page vue.
- Envoi à Meilisearch de `q` (mots-clés, tolérance aux fautes) et du vecteur avec `hybrid.semanticRatio`. Le ratio est un réglage mesuré sur le jeu de référence (point de départ : 0,5).
- Provider indisponible ou désactivé : recherche **mots-clés seule** (`semanticRatio` 0). Jamais d'erreur utilisateur à cause de l'IA.
- Les deux recherches de l'application (catalogue public `ProductCatalogueService#list`, sélecteur RFQ `#lookupForRfq`) passent par un même service, qui renvoie des identifiants ordonnés et le total.

### 8. Jeu de requêtes de référence

Avant de figer modèle, ratio et quantification, et à chaque changement du pipeline : 30 à 50 requêtes versionnées (plusieurs langues, fautes de frappe, synonymes, multi-critères avec filtres), chacune avec ses fiches attendues sur le seed `full`. Mesure du rappel@10 et de la latence. C'est le critère d'acceptation « requête multilingue et requête avec faute » de #112.

### 9. Reconstruction atomique

`search:reindex` écrit dans un index temporaire puis l'échange avec l'index actif (`swap-indexes`) : les recherches ne voient jamais un index à moitié rempli, et un échec laisse l'ancien en place.

### 10. Dimensionnement et quantification

À 1 million de produits en 1024 dimensions `float32`, les vecteurs seuls pèsent environ 4 Go, plus l'index. L'instance Docker M (4 Go) de l'ADR 0003 est insuffisante. Deux leviers, à mesurer :

- **quantification binaire** Meilisearch (`binaryQuantized`) : mémoire divisée par 32. Irréversible, et la documentation signale une perte de qualité sensible sous 512 dimensions et minime au-delà de 1 500 ; à 1 024 l'effet doit être mesuré sur le jeu de référence avant activation ;
- instance plus grande (8 à 16 Go, estimation de #112).

Côté PostgreSQL, les vecteurs restent (environ 2 Go en `halfvec`) mais l'index HNSW (environ 1 Go et sa RAM) est supprimé une fois Meilisearch en service.

### 11. Hébergement

Instance Docker sur Clever Cloud (ADR 0003), version de Meilisearch épinglée. Sans `MEILISEARCH_HOST`, l'indexation est désactivée (dev, test, CI) et le moteur est inerte (`NullSearchEngine`).

### 12. Traductions

Décision reportée à la PR 3 : titres traduits à l'import dans les 32 langues, descriptions à la première ouverture par langue, avec invalidation quand la source change.

### 13. Ce qui disparaît après la bascule

- `products_embedding_idx` (HNSW) et le tri par distance dans `ProductCatalogueService#list`.
- `product_translations.search_vector`, `ProductTranslationSearchService`, les index GIN par locale et l'entrée de `schema_rules.ts`, par une **nouvelle** migration (jamais en modifiant une migration exécutée).
- La règle « ajouter une langue = une entrée `LOCALE_TSCONFIG` + une migration » ; ajouter une langue devient une sous-clé de plus dans `names` / `descriptions`.
- Le repli full-text PostgreSQL : le repli devient « Meilisearch mots-clés seuls ». Si Meilisearch est indisponible, la recherche l'est aussi (message explicite) ; le catalogue par navigation (catégories, fiches) reste servi par PostgreSQL.

## Alternatives écartées

| Option                                                          | Raison du rejet                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rester sur PostgreSQL seul (ADR 0001) en corrigeant le pipeline | Décision du client, et il faudrait construire soi-même la fusion mots-clés + vecteurs (RRF), la tolérance aux fautes (`pg_trgm`), le scan itératif HNSW, et contourner l'absence de dictionnaires sur la base managée. Meilisearch fournit les trois nativement ; c'est ce qui paie la seconde source de données. |
| Embedder REST de Meilisearch (appel direct au provider)         | Plus simple à brancher, mais la clé API vivrait aussi dans Meilisearch, et l'application perdrait l'idempotence, le lot, le cache de requête et le choix libre du provider ; chaque réindexation complète rappellerait l'API.                                                                                     |
| Vecteurs uniquement dans Meilisearch (sans copie PostgreSQL)    | Réindexation = ré-embedding complet. Une panne d'index ou une montée de version qui exige une réindexation coûte alors en API et en temps.                                                                                                                                                                        |
| Imposer `mistral-embed` dans l'architecture                     | Le modèle le mieux placé change vite ; l'abstraction existe déjà et ne coûte rien à conserver. Le choix se fait par la mesure, Mistral restant le défaut.                                                                                                                                                         |
| Écrire dans Meilisearch depuis la requête HTTP                  | Couple la disponibilité d'une écriture catalogue à celle du moteur ; un échec laisserait la base et l'index divergents sans reprise.                                                                                                                                                                              |
| Faire confiance à l'index pour la visibilité                    | Un retard de synchronisation exposerait un produit rejeté ou archivé.                                                                                                                                                                                                                                             |
| Un document par traduction                                      | Multiplie les documents par le nombre de langues, duplique vecteurs et facettes, complique la déduplication. Un document par produit avec des sous-clés par locale suffit, le modèle étant multilingue.                                                                                                           |
| Typesense, OpenSearch, Qdrant/Weaviate + plein texte à côté     | Hors périmètre de la décision du client ; même coût de synchronisation avec, soit une exploitation plus lourde pour une personne seule, soit deux moteurs à combiner.                                                                                                                                             |

## Conséquences

**Positives**

- Recherche multilingue, tolérante aux fautes et hybride sans dictionnaire ni index par langue ; ajouter une langue ne touche ni l'index ni le schéma.
- ET exact garanti deux fois (filtres Meilisearch, puis rechargement PostgreSQL).
- Une seule source de vérité : l'index se reconstruit, la base ne dépend pas de lui. Un incident Meilisearch dégrade la recherche, pas les écritures du catalogue.
- Modèle d'embeddings remplaçable par configuration et ré-embedding explicite ; aucune dépendance architecturale à Mistral.
- Réindexation complète gratuite en appels IA.
- Allègement de PostgreSQL après la bascule (index HNSW et GIN retirés).

**Négatives**

- Une deuxième brique à exploiter (sauvegarde, mise à jour, supervision, volume persistant à valider dans l'ADR 0003).
- Retard de synchronisation possible (quelques secondes), neutralisé à la lecture par la décision 5.
- Les vecteurs sont stockés deux fois (base et index).
- Une indisponibilité de Meilisearch rend la recherche indisponible.
- Coût d'embedding initial (quelques dizaines d'euros pour 1 M de fiches) et à chaque changement de modèle ou de version du texte vectorisé.
- Le code de recherche PostgreSQL (`tsvector` par langue, `ILIKE`) reste en place jusqu'à la bascule, puis est retiré (PR 3).

## Plan de livraison

1. **PR 1 (cette ADR)** : configuration, pilote Meilisearch (`SearchEngine` → `MeilisearchEngine` / `NullSearchEngine`), synchronisation par la queue, `search:reindex`. La recherche de l'application n'est pas encore modifiée.
2. **PR 2** : texte vectorisé et `embedMany` (décision 4), jeu de requêtes de référence (décision 8), choix du modèle, du ratio et de la quantification par la mesure ; bascule du catalogue public et du sélecteur RFQ sur Meilisearch avec cache des vecteurs de requête et repli mots-clés ; mesure de latence.
3. **PR 3** : retrait du HNSW et du `tsvector` par langue par une nouvelle migration (décision 13) ; traductions (décision 12).

## Critères de révision

- Latence p95 d'une recherche hybride avec un ET sur trois facettes supérieure à **300 ms à 1 M de produits** (seuil hérité de l'ADR 0001, à valider avec la mesure de la PR 2).
- Rappel@10 sur le jeu de référence inférieur à celui de la recherche PostgreSQL actuelle sur les mêmes requêtes.
- Coût d'exploitation de Meilisearch (instance + temps) qui fait sortir du budget de l'ADR 0003, ou qui dépasse le gain de RAM sur PostgreSQL.
- Écarts répétés entre l'index et la base que la réindexation ne suffit pas à résorber.
