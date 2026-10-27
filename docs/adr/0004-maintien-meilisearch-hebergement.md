# ADR 0004 : Maintien de Meilisearch, options d'hébergement

- **Statut** : accepté le 2026-10-27
- **Date** : 2026-10-27
- **Issues liées** : #112 (moteur de recherche)
- **Complète** : [ADR 0002](0002-recherche-meilisearch-hybride.md) et [ADR 0003](0003-hebergement-clever-cloud.md) (ligne « Meilisearch »)

## Contexte

Le volume persistant de Meilisearch sur une instance Docker Clever Cloud n'a jamais été confirmé (système de fichiers éphémère). Clever Cloud a recommandé son add-on Elasticsearch managé (M : 80 € HT/mois, L : 160 € HT/mois). Une migration vers Elasticsearch a été développée en local (`ElasticsearchEngine`, hybride `semantic_text` + retriever `linear`, bascule par alias), validée contre un Elasticsearch 8.19.1 réel, puis **abandonnée avant tout push**.

## Décision

**Le client impose Meilisearch. Le moteur reste Meilisearch** ; ADR 0002 inchangé (hybride, ET exact, PostgreSQL source de vérité). La seule question ouverte est l'hébergement managé.

### Pistes d'hébergement

| Option                             | Pour                                                                               | À vérifier                                                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Meilisearch Cloud** (éditeur)    | Exploitation, sauvegardes et mises à jour par l'éditeur ; pas de volume à résoudre | Région UE (RGPD), tarif pour ~300 000 produits avec vecteurs, embedder `rest` (Mistral) accepté, clé API hors accès maître |
| **Clever Cloud** (Docker + volume) | Même fournisseur que le reste, facture unique                                      | Volume persistant **confirmé par écrit**, snapshots, taille, accès sortant vers l'API d'embeddings                         |

Recommandation : Meilisearch Cloud si prix et région conviennent, sinon Clever Cloud avec volume confirmé par le support. Le choix ne change que `MEILISEARCH_HOST` / `MEILISEARCH_API_KEY`.

## Conséquences

- Aucun changement de code : retour à l'état d'avant la migration (reverts des commits `bc80584`, `1f0d111`, `f954a15`).
- Le travail Elasticsearch reste dans l'historique git (`bc80584`, `1f0d111`) si le choix est rouvert.
- Dimensionnement et coût de l'instance Meilisearch à fixer après la réponse du fournisseur retenu.
