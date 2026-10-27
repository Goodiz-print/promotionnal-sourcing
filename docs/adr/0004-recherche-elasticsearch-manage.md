# ADR 0004 : Elasticsearch managé (Clever Cloud) à la place de Meilisearch

- **Statut** : accepté le 2026-10-27 (suit la recommandation de Clever Cloud) ; les six réserves de la décision 5 sont **supposées levées** ; Meilisearch a été retiré du code (PR 2 et 3 fusionnées, 2026-10-27)
- **Date** : 2026-10-27
- **Issues liées** : #112 (moteur de recherche)
- **Remplace** : [ADR 0002](0002-recherche-meilisearch-hybride.md), décisions 3 (embedder), 10 (dimensionnement) et 11 (hébergement) ; amende [ADR 0003](0003-hebergement-clever-cloud.md) (ligne « Meilisearch »)

## Contexte

L'ADR 0002 retient Meilisearch hébergé sur une instance Docker de Clever Cloud, avec « volume persistant à confirmer » (ADR 0003, `docs/deploiement.md`). Ce point n'a jamais été levé. L'échange avec Clever Cloud (octobre 2026, hypothèse de départ de **300 000 produits**) donne :

- une instance Docker a un système de fichiers éphémère : Meilisearch, qui a besoin d'un stockage persistant pour ses index, n'y est pas recommandé en production sans architecture spécifique ;
- Clever Cloud propose **Elasticsearch en add-on entièrement managé** (exploitation, supervision, sauvegardes quotidiennes incluses) ;
- Clever Cloud recommande de séparer le moteur de recherche de PostgreSQL, du web et du worker.

Le projet est porté par une seule personne : l'exploitation d'un moteur auto-hébergé (volume, snapshots, supervision) est précisément la charge que l'ADR 0003 voulait éviter en choisissant Clever Cloud.

## Décision

**Le moteur de recherche devient Elasticsearch managé (add-on Clever Cloud). PostgreSQL reste la source de vérité ; la synchronisation par la queue, le rechargement depuis PostgreSQL et le ET exact sont inchangés.**

Ce qui ne bouge pas (ADR 0002, décisions 1, 2, 4, 5, 6, 8, 9) : index de lecture reconstruisible (`search:reindex`, bascule atomique par alias), jobs idempotents qui reconstruisent le document depuis la base, `embeddingText` (nom en langue source, catégorie, facettes, début de description), visibilité rejugée par PostgreSQL, jeu de requêtes de référence et `search:evaluate`.

### 1. Branchement

`SearchEngine` est déjà une classe abstraite liée dans `providers/search_provider.ts`. On ajoute `ElasticsearchEngine` (client officiel `@elastic/elasticsearch`) et on retire `MeilisearchEngine` une fois la parité mesurée. Aucun contrôleur, job, listener ni `ProductSearchService` ne change. Sans `ELASTICSEARCH_URL`, `NullSearchEngine` reste lié (dev, test, CI sans moteur).

### 2. Correspondance des fonctions

| Besoin                       | Meilisearch (aujourd'hui)                               | Elasticsearch (cible)                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document par produit         | `addDocuments`, clé `id`                                | `bulk` index, `_id` = id produit                                                                                                                                            |
| Noms/descriptions par langue | objets `names`, `descriptions` (un attribut cherchable) | champs `names.<locale>` / `descriptions.<locale>` avec analyzer par langue ou ICU ; **le mapping des 32 langues est le gros chantier**                                      |
| ET exact                     | `attributeValueIds = 3 AND attributeValueIds = 7`       | clauses `filter` : `term` par valeur de facette (pré-filtre, hors score)                                                                                                    |
| Tolérance aux fautes         | native                                                  | `fuzziness: AUTO` sur les champs textuels, à régler par `search:evaluate`                                                                                                   |
| Hybride                      | `hybrid.semanticRatio`                                  | retriever `linear` (BM25 pondéré `1 − ratio` + `semantic_text` pondéré `ratio`, scores `minmax`) : reproduit le `semanticRatio` ; **version ≥ 8.18 et licence à confirmer** |
| Embeddings                   | embedder `huggingFace` ou `rest`                        | endpoint d'inférence (Mistral par défaut) + `semantic_text` / `dense_vector`                                                                                                |
| Reconstruction atomique      | index temporaire + `swapIndexes`                        | index `products_<env>_<horodatage>` + alias `products_<env>` basculé par `_aliases`                                                                                         |
| Pagination                   | `page` / `hitsPerPage`                                  | `from` / `size` (plafond 10 000 résultats : le catalogue public pagine bien en deçà)                                                                                        |

### 3. Embeddings

Elasticsearch sait vectoriser (API d'inférence, champ `semantic_text`) ; il appelle lui-même un service externe, comme l'embedder `rest` de Meilisearch. **Défaut : endpoint d'inférence Mistral (`mistral-embed`, 1024 dimensions)**. Le modèle local `huggingface` de l'ADR 0002 disparaît (il n'a jamais été validé) ; un modèle hébergé dans le cluster (E5 multilingue) suppose des nœuds ML sous licence et n'est retenu que si Clever Cloud le propose.

Repli identique : si l'inférence échoue, la requête est rejouée en BM25 seul. Si `semantic_text` ou l'inférence sont indisponibles sur l'add-on, **plan B** : l'application calcule les vecteurs (champ `dense_vector`, kNN avec vecteur fourni) — décision à prendre sur les réponses de Clever Cloud, au prix du code d'embedding que l'ADR 0002 avait supprimé.

### 4. Dimensionnement et coût

Recommandation de Clever Cloud, reprise : **Elasticsearch M** (2 vCPU, 4 Go, 120 Go, 80 € HT/mois) au lancement, sous réserve de tests de performance ; **L** (4 vCPU, 8 Go, 240 Go, 160 € HT/mois) si le catalogue entier est indexé dès le départ avec vecteurs et filtres nombreux. Le dimensionnement de Clever Cloud suppose un catalogue textuel : 300 000 vecteurs de 1 024 dimensions pèsent ~1,2 Go bruts avant structures d'index, **à mesurer** avant de figer M ou L.

| Poste                             | Config. M (HT/mois) | Config. L (HT/mois) |
| --------------------------------- | ------------------- | ------------------- |
| Web (S)                           | 32 €                | 32 €                |
| Worker (XS)                       | 16 €                | 16 €                |
| PostgreSQL (S Big Space)          | 47 €                | 47 €                |
| Elasticsearch                     | 80 €                | 160 €               |
| Cellar (50 Go + 500 Go de trafic) | 46 €                | 46 €                |
| **Total**                         | **221 €**           | **301 €**           |

Dans le budget de l'ADR 0003 (100 à 500 €/mois). Pas de haute disponibilité à ce prix : elle exige 3 nœuds (≈ 3 × M + 300 € d'installation), reportée.

Le voucher de 250 € de Clever Cloud finance la phase de test (PR 2).

### 5. Réserves à lever avant la PR 1

À demander à Clever Cloud (aucune n'est vérifiée) :

1. **Version d'Elasticsearch** de l'add-on (`semantic_text` et l'API d'inférence demandent une version récente).
2. **Licence** : la fusion RRF, l'inférence et les fonctions ML sont-elles incluses ?
3. **Embeddings** : un modèle multilingue est-il hébergeable sur M/L, ou passe-t-on par une API externe (Mistral) ?
4. Accès réseau sortant du cluster vers l'API Mistral (l'inférence est appelée par Elasticsearch).
5. Plugins disponibles (ICU, analyzers par langue), versionnement des mises à jour, restauration d'une sauvegarde.
6. Staging : prix et taille d'une instance de test (XS ?).

## Alternatives écartées

| Option                                              | Raison du rejet                                                                                                                                                                                                                        |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rester sur Meilisearch (Docker + volume persistant) | Le volume persistant n'a jamais été confirmé et Clever Cloud ne recommande pas ce montage en production : une brique critique sans exploitation managée pour une personne seule. À rouvrir si l'add-on Elasticsearch échoue aux tests. |
| Meilisearch sur un VPS (Scaleway…)                  | Écarté par l'ADR 0003 : 60 à 100 h/an d'administration système.                                                                                                                                                                        |
| Revenir à PostgreSQL seul                           | Écarté par l'ADR 0002 (décision du client, fusion hybride et fautes à reconstruire).                                                                                                                                                   |

## Conséquences

**Positives**

- Moteur managé : sauvegardes, supervision et mises à jour par Clever Cloud ; plus de volume persistant à résoudre.
- Séparation nette du moteur et de PostgreSQL ; coût prévisible (221 à 301 € HT/mois tout compris).
- Facettes et agrégations plus riches, montée en charge possible (réplicas, nœuds) ; migration bornée grâce à `SearchEngine`.

**Négatives**

- Mapping multilingue à construire (analyzers par langue) et réglage de la pertinence à refaire : le « un attribut cherchable pour toutes les langues » de Meilisearch n'existe pas.
- Perte du modèle d'embeddings local sans clé : coût par token (Mistral) et textes envoyés à un tiers européen.
- Exploitation JVM (heap, shards) cachée par le managé mais présente dans le dimensionnement ; M peut être juste avec des vecteurs.
- Licence : certaines fonctions (RRF, ML) peuvent ne pas être incluses — réserve 2.
- Pas de HA sans 3 nœuds.

## Plan de livraison

1. **PR 0** : réponses de Clever Cloud (réserves 1 à 6) ; compléter cet ADR ; statut « accepté » ou plan B pour les embeddings.
2. **PR 1** : `ElasticsearchEngine` (mapping, upsert, search, remove, `replaceAll` par alias), configuration `ELASTICSEARCH_*`, `docker-compose` de dev, tests unitaires du pilote contre un `fetch`/client simulé.
3. **PR 2** : job CI `test-search` contre un vrai Elasticsearch ; `search:evaluate` sur le jeu de référence ; test M/L avec le voucher (rappel@10, p95, mémoire, coût de réindexation) ; réglage de `fuzziness`, du ratio et de l'analyzer.
4. **PR 3** : bascule en staging puis production (`search:reindex`), retrait de `MeilisearchEngine`, de la dépendance `meilisearch`, du service `docker-compose`, de `MEILISEARCH_*` ; mise à jour de `CLAUDE.md`, `docs/search.md`, `docs/deploiement.md` et du changelog.

## Critères de révision

- Latence p95 d'une recherche hybride avec ET sur trois facettes supérieure à **300 ms** sur l'instance retenue (seuil des ADR 0001 et 0002).
- Rappel@10 inférieur à celui obtenu avec Meilisearch sur le même jeu de référence.
- Réponses de Clever Cloud incompatibles avec l'hybride (pas de RRF/`semantic_text` et plan B trop coûteux).
- Coût mensuel hors du budget de l'ADR 0003.
