# ADR 0002 : recherche hybride Meilisearch, vecteurs calculés par Meilisearch

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

- Une vectorisation applicative existait (`EmbeddingService`, `GenerateProductEmbeddingJob`, `products.embedding` en `halfvec(1024)` avec index HNSW) mais n'avait jamais tourné sur de vrais embeddings : désactivée par défaut. Elle est **supprimée** au profit de l'embedder de Meilisearch (décision 3).
- La recherche sémantique PostgreSQL n'est pas hybride : dès qu'un vecteur de requête existe, le plein texte est abandonné et tout le catalogue vectorisé est trié par distance, sans seuil. Les filtres ET sont appliqués après le parcours de l'index HNSW (post-filtrage), ce qui peut renvoyer zéro résultat sur une requête sélective.
- Le texte vectorisé concatène toutes les traductions : chaque traduction automatique qui arrive change la clé d'idempotence et provoque un recalcul payant.
- Un appel API par produit, sans lot ; un appel synchrone par recherche, sans cache.
- Le plein texte par langue dépend de dictionnaires PostgreSQL que la base managée Clever Cloud ne fournit pas (`docs/deploiement.md`).

Le projet est porté par une seule personne, avec un budget d'infrastructure de 100 à 500 € par mois (ADR 0001, ADR 0003).

## Décision

**Meilisearch sert la recherche (mots-clés + vecteurs, filtres exacts) et calcule lui-même les vecteurs. PostgreSQL reste la source de vérité des fiches.**

| Rôle                                             | Où                                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| Source de vérité (fiches, traductions, facettes) | PostgreSQL                                                                    |
| Texte à vectoriser (`embeddingText`)             | Application (`ProductIndexService`), poussé dans chaque document              |
| Calcul des embeddings (fiches et requêtes)       | Meilisearch, embedder `rest` appelant l'API d'embeddings (Mistral par défaut) |
| Conservation des vecteurs                        | Meilisearch seul (aucune copie PostgreSQL)                                    |
| Index de recherche, hybride, filtres, facettes   | Meilisearch                                                                   |
| Règles de visibilité finales                     | PostgreSQL (rechargement des résultats)                                       |

### 1. PostgreSQL reste la source de vérité

Meilisearch est un **index de lecture**, jamais écrit autrement que depuis la base. Un index perdu ou corrompu se reconstruit par `node ace search:reindex`, sans perte de données. **La reconstruction rappelle l'API d'embeddings** pour toutes les fiches (les vecteurs ne sont conservés que dans l'index) : environ 20 $ pour 1 M de fiches avec `mistral-embed`, à confirmer sur la grille. À ce prix et à ce rythme de réindexation (premier déploiement, montée de version, changement de modèle), le choix est assumé (voir « Alternatives écartées »).

### 2. Synchronisation par la queue, jamais dans la requête HTTP

Toute écriture qui change ce que l'index doit contenir (création, mise à jour, suppression, traduction, vecteur, modération, archivage) émet un événement (`ProductChanged`, `OrganizationCatalogueChanged`) ; son listener met en queue `IndexProductJob` (ou `IndexOrganizationProductsJob`). Le job **reconstruit le document depuis la base** à chaque exécution : il est idempotent, sûr dans le désordre (le dernier passage reflète l'état courant) et rejouable après échec (5 tentatives). Un échec de mise en queue est loggé sans être propagé : la base est à jour, la prochaine synchronisation ou `search:reindex` rattrape.

### 3. Vecteurs calculés par Meilisearch, provider non imposé

L'index déclare un embedder `rest` (`buildEmbedders`, `app/services/search/meilisearch_engine.ts`) : Meilisearch appelle lui-même l'API d'embeddings (format OpenAI `/embeddings`, que Mistral partage) pour vectoriser le champ `embeddingText` de chaque document à l'indexation, et le texte de la requête à la recherche. L'application n'appelle jamais le provider, et n'a plus de job, de service, de cache ni de colonne d'embeddings.

**Mistral n'est pas une obligation.** L'embedder est un paramètre de configuration (`config/search.ts` : `AI_PROVIDER`, `MISTRAL_API_KEY` / `MISTRAL_EMBED_MODEL`, ou `AI_API_KEY` / `AI_BASE_URL` / `AI_EMBED_MODEL` pour tout endpoint compatible OpenAI), choisi par la mesure sur le jeu de requêtes de référence (décision 8). Ce qui est figé :

- un **seul** embedder actif à la fois : un vecteur de requête n'est comparable qu'à des vecteurs du même modèle ;
- changer de modèle ou de dimension change les réglages de l'index puis exige `search:reindex` (Meilisearch ne mélange pas deux modèles dans un index) ;
- la dimension (`SEARCH_EMBEDDING_DIMENSIONS`, 1024) est celle de l'embedder ; un modèle d'une autre dimension change cette constante.

**Activation** : active dès que le provider est configuré, coupée sinon (dev, CI) et en `NODE_ENV=test` ; `AI_EMBEDDINGS_ENABLED=false` la coupe, `=true` sans identifiants échoue au démarrage. Coupé, l'embedder est retiré des réglages et la recherche reste par mots-clés.

Candidats à comparer, par ordre de préférence a priori :

| Modèle                                    | Accès                                                                                                          | Pour                                                                                   | Contre                                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `mistral-embed` (1024)                    | API Mistral, embedder `rest`                                                                                   | Hébergeur européen (RGPD sans transfert), multilingue, 1024 dimensions natives         | Clé API stockée aussi dans Meilisearch                                               |
| `bge-m3`, `multilingual-e5-large`         | Ollama, vLLM ou TEI auto-hébergé, embedder `rest` compatible OpenAI ; ou embedder `huggingFace` de Meilisearch | Open-weight, 100+ langues, aucun coût par token, données qui ne sortent pas de l'infra | Un serveur à exploiter (contraire à l'ADR 0003), ou CPU Meilisearch sous-dimensionné |
| `text-embedding-3-small`                  | API OpenAI, embedder `rest`                                                                                    | Peu coûteux, dimension réductible (paramètre `dimensions`)                             | Données hors UE, à cadrer contractuellement                                          |
| `voyage-3`, `embed-multilingual` (Cohere) | API                                                                                                            | Très bons scores multilingues rapportés                                                | Fournisseurs non européens, format de réponse à vérifier                             |

Tant que la mesure n'est pas faite, `mistral-embed` reste la valeur par défaut.

### 4. Texte vectorisé

Le texte que Meilisearch vectorise (`ProductIndexService.embeddingText`, poussé dans chaque document sous `embeddingText`, lu par le `documentTemplate` de l'embedder) est conçu pour la recherche, pas pour l'affichage :

1. nom dans la **langue source** de la fiche uniquement (les modèles retenus sont multilingues ; concaténer les traductions allonge le texte et le fait changer à chaque traduction automatique, donc ré-embedder) ;
2. libellé de la catégorie (langue source) ;
3. libellés des facettes sous forme « attribut : valeur » (« couleur : noir », « matière : coton », « grammage : 200 g/m² ») ;
4. début de la description, tronqué à 300 caractères.

Meilisearch ne rappelle l'API que lorsque ce texte change pour un document donné (à confirmer à l'usage). Toute modification de la construction du texte se répercute à la prochaine synchronisation du produit, ou par `search:reindex` pour tout le catalogue. Les lots d'appels à l'API sont gérés par Meilisearch (`input` reçoit un tableau de textes).

### 5. Visibilité jugée par PostgreSQL à la lecture

Seuls les produits visibles (actifs, organisation vivante, non rejetés) sont indexés, mais un index est toujours en retard d'un instant : les produits retournés par Meilisearch sont **rechargés depuis PostgreSQL**, dans l'ordre renvoyé, et ceux qui ne sont plus visibles sont écartés. Un retard de synchronisation ne peut jamais exposer un produit retiré.

### 6. Filtre ET

Les filtres Meilisearch sur des identifiants (`attributeValueIds = 3 AND attributeValueIds = 7`, catégorie, pays, Made in Europe) sont des **pré-filtres booléens exacts**, appliqués avant le classement : ils garantissent le ET dans le moteur, comme SQL le garantissait. La base **revérifie** les facettes sur les produits rechargés (au plus une page) ; la suite de requêtes de référence tranche si cette revérification reste nécessaire.

### 7. Requête hybride

- L'application envoie `q`, les filtres et `hybrid: { embedder, semanticRatio }` ; **Meilisearch vectorise `q`** lui-même. Le ratio (`SEARCH_SEMANTIC_RATIO`, point de départ 0,5) est un réglage mesuré sur le jeu de référence.
- Provider d'embeddings indisponible, limité en débit ou désactivé : la recherche est **rejouée par mots-clés seuls** (`semanticRatio` 0, sans appel à l'API). Jamais d'erreur utilisateur à cause de l'IA.
- Le sélecteur de produit des demandes de devis est toujours par mots-clés seuls : pas d'appel à l'API à chaque frappe.
- Les deux recherches de l'application (catalogue public `ProductCatalogueService#list`, sélecteur RFQ `#lookupForRfq`) passent par `ProductSearchService`, qui renvoie des produits rechargés depuis PostgreSQL et le total.

### 8. Jeu de requêtes de référence

Avant de figer modèle, ratio et quantification, et à chaque changement du pipeline : 30 à 50 requêtes versionnées (plusieurs langues, fautes de frappe, synonymes, multi-critères avec filtres), chacune avec ses fiches attendues sur le seed `full`. Mesure du rappel@10 et de la latence. C'est le critère d'acceptation « requête multilingue et requête avec faute » de #112.

### 9. Reconstruction atomique

`search:reindex` écrit dans un index temporaire puis l'échange avec l'index actif (`swap-indexes`) : les recherches ne voient jamais un index à moitié rempli, et un échec laisse l'ancien en place.

### 10. Dimensionnement et quantification

À 1 million de produits en 1024 dimensions `float32`, les vecteurs seuls pèsent environ 4 Go, plus l'index. L'instance Docker M (4 Go) de l'ADR 0003 est insuffisante. Deux leviers, à mesurer :

- **quantification binaire** Meilisearch (`binaryQuantized`) : mémoire divisée par 32. Irréversible, et la documentation signale une perte de qualité sensible sous 512 dimensions et minime au-delà de 1 500 ; à 1 024 l'effet doit être mesuré sur le jeu de référence avant activation ;
- instance plus grande (8 à 16 Go, estimation de #112).

Côté PostgreSQL, les colonnes `products.embedding` et `embedding_key` ainsi que l'index HNSW (environ 3 Go avec les vecteurs, plus la RAM de l'index) sont supprimés (décision 13) : les vecteurs ne vivent plus que dans Meilisearch, **une seule fois**.

### 11. Hébergement

Instance Docker sur Clever Cloud (ADR 0003), version de Meilisearch épinglée. Sans `MEILISEARCH_HOST`, l'indexation est désactivée (dev, test, CI) et le moteur est inerte (`NullSearchEngine`).

### 12. Traductions

Décision reportée à la PR 3 : titres traduits à l'import dans les 32 langues, descriptions à la première ouverture par langue, avec invalidation quand la source change.

### 13. Ce qui disparaît après la bascule

- `products.embedding`, `products.embedding_key` et `products_embedding_idx` (HNSW) : plus rien ne les écrit ni ne les lit (le tri par distance de `ProductCatalogueService#list` est déjà retiré). Suppression par une **nouvelle** migration en PR 3.
- `product_translations.search_vector`, `ProductTranslationSearchService`, les index GIN par locale et l'entrée de `schema_rules.ts`, par une **nouvelle** migration (jamais en modifiant une migration exécutée).
- La règle « ajouter une langue = une entrée `LOCALE_TSCONFIG` + une migration » ; ajouter une langue devient une sous-clé de plus dans `names` / `descriptions`.
- Le repli full-text PostgreSQL : le repli devient « Meilisearch mots-clés seuls ». Si Meilisearch est indisponible, la recherche l'est aussi (message explicite) ; le catalogue par navigation (catégories, fiches) reste servi par PostgreSQL.

## Alternatives écartées

| Option                                                          | Raison du rejet                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rester sur PostgreSQL seul (ADR 0001) en corrigeant le pipeline | Décision du client, et il faudrait construire soi-même la fusion mots-clés + vecteurs (RRF), la tolérance aux fautes (`pg_trgm`), le scan itératif HNSW, et contourner l'absence de dictionnaires sur la base managée. Meilisearch fournit les trois nativement ; c'est ce qui paie la seconde source de données.                                                                                                                             |
| Vecteurs calculés par l'application (embedder `userProvided`)   | Solution retenue d'abord : `EmbeddingService`, job d'embedding, copie en `products.embedding`, backfill, cache des vecteurs de requête, tout cela à maintenir pour une personne seule. Son avantage — réindexer sans rappeler l'API — ne vaut pas ce code à ce volume : une réindexation complète coûte une vingtaine de dollars pour 1 M de fiches. À reconsidérer si la fréquence des réindexations ou le volume change cette arithmétique. |
| Imposer `mistral-embed` dans l'architecture                     | Le modèle le mieux placé change vite ; l'embedder est un paramètre de configuration. Le choix se fait par la mesure, Mistral restant le défaut.                                                                                                                                                                                                                                                                                               |
| Écrire dans Meilisearch depuis la requête HTTP                  | Couple la disponibilité d'une écriture catalogue à celle du moteur ; un échec laisserait la base et l'index divergents sans reprise.                                                                                                                                                                                                                                                                                                          |
| Faire confiance à l'index pour la visibilité                    | Un retard de synchronisation exposerait un produit rejeté ou archivé.                                                                                                                                                                                                                                                                                                                                                                         |
| Un document par traduction                                      | Multiplie les documents par le nombre de langues, duplique vecteurs et facettes, complique la déduplication. Un document par produit avec des sous-clés par locale suffit, le modèle étant multilingue.                                                                                                                                                                                                                                       |
| Typesense, OpenSearch, Qdrant/Weaviate + plein texte à côté     | Hors périmètre de la décision du client ; même coût de synchronisation avec, soit une exploitation plus lourde pour une personne seule, soit deux moteurs à combiner.                                                                                                                                                                                                                                                                         |

## Conséquences

**Positives**

- Recherche multilingue, tolérante aux fautes et hybride sans dictionnaire ni index par langue ; ajouter une langue ne touche ni l'index ni le schéma.
- ET exact garanti deux fois (filtres Meilisearch, puis rechargement PostgreSQL).
- Une seule source de vérité : l'index se reconstruit, la base ne dépend pas de lui. Un incident Meilisearch dégrade la recherche, pas les écritures du catalogue.
- Moins de code applicatif : plus de job, de service, de cache, de colonne ni de commande d'embeddings. Meilisearch gère les lots, les rejeux et la vectorisation des requêtes.
- Modèle d'embeddings remplaçable par configuration (réglages de l'index puis `search:reindex`) ; aucune dépendance architecturale à Mistral.
- Allègement de PostgreSQL après la bascule (vecteurs, index HNSW et GIN retirés).

**Négatives**

- Une deuxième brique à exploiter (sauvegarde, mise à jour, supervision, volume persistant à valider dans l'ADR 0003).
- Retard de synchronisation possible (quelques secondes), neutralisé à la lecture par la décision 5.
- Les vecteurs n'existent que dans l'index : le perdre, c'est ré-embedder (payant) pour le reconstruire, et on ne compare pas deux modèles hors de Meilisearch.
- La clé de l'API d'embeddings est aussi stockée dans les réglages de Meilisearch, qui appelle lui-même le provider (échec d'API = tâche d'indexation en échec, rejouée par notre job).
- Une indisponibilité de Meilisearch rend la recherche indisponible.
- Coût d'embedding initial (quelques dizaines d'euros pour 1 M de fiches) et à chaque réindexation complète, changement de modèle ou de texte vectorisé.
- Le code de recherche PostgreSQL (`tsvector` par langue, `ILIKE`) reste en place jusqu'à la bascule, puis est retiré (PR 3).

## Plan de livraison

1. **PR 1 (cette ADR)** : configuration, pilote Meilisearch (`SearchEngine` → `MeilisearchEngine` / `NullSearchEngine`), synchronisation par la queue, `search:reindex`. La recherche de l'application n'est pas encore modifiée.
2. **PR 2** : bascule du catalogue public et du sélecteur RFQ sur Meilisearch (`ProductSearchService`) avec repli (PostgreSQL pendant la transition, puis mots-clés seuls), jeu de requêtes de référence et `search:evaluate` (décision 8), job CI contre un vrai Meilisearch.
   **PR 2b** : embedder `rest` de Meilisearch et texte vectorisé (décisions 3 et 4), suppression de la vectorisation applicative ; puis, à faire avec la clé réelle, choix du modèle, du ratio et de la quantification par la mesure (`search:evaluate`) sur des fiches multilingues ; mesure de latence à volume.
3. **PR 3** : retrait du HNSW et du `tsvector` par langue par une nouvelle migration (décision 13) ; traductions (décision 12).

## Critères de révision

- Latence p95 d'une recherche hybride avec un ET sur trois facettes supérieure à **300 ms à 1 M de produits** (seuil hérité de l'ADR 0001, à valider avec la mesure de la PR 2).
- Rappel@10 sur le jeu de référence inférieur à celui de la recherche PostgreSQL actuelle sur les mêmes requêtes.
- Coût d'exploitation de Meilisearch (instance + temps) qui fait sortir du budget de l'ADR 0003, ou qui dépasse le gain de RAM sur PostgreSQL.
- Écarts répétés entre l'index et la base que la réindexation ne suffit pas à résorber.
