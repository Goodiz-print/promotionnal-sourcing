# ADR 0002 : recherche hybride avec Meilisearch, en remplacement de la recherche PostgreSQL

- **Statut** : proposé (à valider par le titulaire du projet)
- **Date** : 2026-10-25
- **Issues liées** : #112 (migration vers Meilisearch) ; #69, #70, #71 (benchmark et pgvector de l'ADR 0001, à réorienter ou fermer)
- **Remplace** : [ADR 0001](0001-recherche-postgresql.md)

## Contexte

L'ADR 0001 gardait la recherche dans PostgreSQL : ET exact par relations SQL, plein texte par langue (`tsvector`), recherche sémantique (pgvector). Le client a validé un autre choix, **Meilisearch en recherche hybride** (mots-clés + vecteurs multilingues), pour trois raisons :

- l'empreinte vectorielle d'une fiche ne dépend pas de la langue : une requête dans une langue trouve une fiche décrite dans une autre ;
- pas de dictionnaire ni d'index par langue : ajouter une langue ne touche pas au catalogue ;
- filtres, facettes et tolérance aux fautes natifs.

L'ADR 0001 prévoyait ce cas comme plan de repli : _Meilisearch comme index de lecture seul, alimenté par la queue, PostgreSQL restant la source de vérité_. C'est exactement la décision ci-dessous.

## Décision

1. **PostgreSQL reste la source de vérité.** Meilisearch est un **index de lecture**, jamais écrit autrement que depuis la base. Un index perdu ou corrompu se reconstruit par `node ace search:reindex`, sans perte.
2. **Synchronisation par la queue**, jamais dans la requête HTTP. Toute écriture qui change ce que l'index doit contenir (création, mise à jour, suppression, traduction, vecteur, modération, archivage) émet un événement ; son listener met en queue `IndexProductJob` (ou `IndexOrganizationProductsJob`). Le job **reconstruit le document depuis la base** à chaque exécution : il est idempotent, sûr dans le désordre (le dernier passage reflète l'état courant) et rejouable après échec (5 tentatives).
3. **Vecteurs fournis par l'application** (embedder Meilisearch `userProvided`, 1024 dimensions). Le job `GenerateProductEmbeddingJob` existant calcule les embeddings `mistral-embed` avec sa clé d'idempotence ; Meilisearch ne fait que les stocker et les comparer. On ne confie pas à Meilisearch l'appel à l'API Mistral : un seul endroit appelle le fournisseur d'IA, avec sa gestion d'idempotence et de coût. Les vecteurs restent aussi dans `products.embedding` (source de vérité, nécessaire à la réindexation sans nouvel appel d'API).
4. **Visibilité jugée par PostgreSQL à la lecture.** Seuls les produits visibles (actifs, organisation vivante, non rejetés) sont indexés, mais un index est toujours en retard d'un instant : les produits retournés par Meilisearch sont **rechargés depuis PostgreSQL**, qui écarte ceux qui ne sont plus visibles. Un retard de synchronisation ne peut donc jamais exposer un produit retiré.
5. **Filtre ET.** Les filtres de Meilisearch sur des identifiants (`attributeValueIds = 3 AND attributeValueIds = 7`, catégorie, pays) sont des **filtres booléens exacts**, pas de la pertinence : ils garantissent le ET dans le moteur. Ils sont appliqués comme pré-filtre de la recherche hybride, et la base **revérifie** les facettes sur les produits retournés (coût négligeable : au plus une page). La suite de requêtes de référence (PR 2) tranche si cette revérification reste nécessaire.
6. **Reconstruction atomique.** `search:reindex` écrit dans un index temporaire puis l'échange avec l'index actif (`swap-indexes`) : les recherches ne voient jamais un index à moitié rempli, et un échec laisse l'ancien en place.
7. **Embeddings : `mistral-embed`** (déjà en place, 1024 dimensions) est conservé. La comparaison avec d'autres modèles se fera sur la suite de requêtes de référence ; changer de modèle change la clé d'idempotence et provoque un recalcul complet.
8. **Hébergement : instance Docker sur Clever Cloud** (ADR 0003), version de Meilisearch épinglée. Sans `MEILISEARCH_HOST`, l'indexation est désactivée (dev, test, CI) et le moteur est inerte.
9. **Traductions** : décision reportée à la PR suivante (titres traduits à l'import dans les 32 langues, descriptions à la première ouverture par langue, avec invalidation quand la source change).

## Alternatives écartées

| Option                                                | Raison du rejet                                                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Rester sur PostgreSQL (ADR 0001)                      | Décision du client : recherche multilingue sans index par langue, tolérance aux fautes native.                                       |
| Embedder REST de Meilisearch (appel direct à Mistral) | La clé Mistral vivrait aussi dans Meilisearch, et on perdrait l'idempotence maîtrisée côté application (coût, rejeux).               |
| Écrire dans Meilisearch depuis la requête HTTP        | Couple la disponibilité d'une écriture catalogue à celle du moteur ; un échec laisserait la base et l'index divergents sans reprise. |
| Faire confiance à l'index pour la visibilité          | Un retard de synchronisation exposerait un produit rejeté ou archivé.                                                                |
| Typesense, OpenSearch                                 | Hors périmètre de la décision du client ; OpenSearch est nettement plus lourd à exploiter pour une personne seule.                   |

## Conséquences

**Positives**

- Recherche multilingue sans dictionnaire par langue ; ajouter une langue ne touche ni l'index ni le schéma.
- Une seule source de vérité : l'index se reconstruit, la base ne dépend pas de lui.
- Un incident Meilisearch dégrade la recherche, pas les écritures du catalogue.

**Négatives**

- Une deuxième brique à exploiter (sauvegarde, mise à jour, supervision) et un retard de synchronisation possible (quelques secondes), neutralisé à la lecture par la décision 4.
- Les vecteurs sont stockés deux fois (base et index).
- Le code de recherche PostgreSQL (`tsvector` par langue, requêtes `ILIKE`) reste en place jusqu'à la bascule, puis est retiré (PR 3).

## Plan de livraison

1. **PR 1 (cette ADR)** : configuration, pilote Meilisearch, synchronisation par la queue, `search:reindex`. La recherche de l'application n'est pas encore modifiée.
2. **PR 2** : bascule du catalogue public et du sélecteur de produit des demandes de devis sur Meilisearch, suite de requêtes de référence (plusieurs langues, fautes de frappe, requêtes multi-critères) exécutée à chaque changement du pipeline de recherche, mesure de latence.
3. **PR 3** : retrait du `tsvector` par langue (`ProductTranslationSearchService`, `search_vector`, `schema_rules.ts`) par une nouvelle migration, sans modifier une migration déjà exécutée en production ; traductions (décision 9).

## Critères de révision

À revoir si la latence p95 d'une recherche hybride avec un ET sur trois facettes dépasse **300 ms à 1 M de produits** (seuil proposé, à valider avec la mesure de la PR 2), ou si le coût d'exploitation de Meilisearch dépasse le gain de RAM sur PostgreSQL.
