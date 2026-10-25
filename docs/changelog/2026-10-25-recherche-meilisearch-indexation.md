# Recherche Meilisearch : ADR 0002 et indexation des produits (#112, 1/3)

> Date : 2026-10-25

Première étape de la migration vers la recherche hybride Meilisearch. **La recherche de l'application n'est pas encore modifiée** : on construit et on tient à jour l'index.

- **ADR 0002** (`docs/adr/0002-recherche-meilisearch-hybride.md`, statut _proposé_) : PostgreSQL source de vérité, synchronisation par la queue, vecteurs calculés par l'application (provider d'embeddings configurable, Mistral par défaut et non imposé) et conservés dans PostgreSQL, texte vectorisé conçu pour la recherche, requête hybride avec cache et repli mots-clés, visibilité rejugée par PostgreSQL à la lecture, reconstruction atomique, dimensionnement et quantification à mesurer. L'ADR 0001 passe en « remplacé par 0002 ».
- **Configuration** : `MEILISEARCH_HOST` et `MEILISEARCH_API_KEY` (optionnelles, validées dans `start/env.ts`), `config/search.ts`. Sans hôte, l'indexation est inerte.
- **Pilote** : `SearchEngine` (abstraction), `MeilisearchEngine` (SDK officiel `meilisearch`), `NullSearchEngine`, lié par `providers/search_provider.ts`.
- **Synchronisation** : événements `ProductChanged` / `OrganizationCatalogueChanged` → `IndexProductJob` / `IndexOrganizationProductsJob`, déclenchés par les écritures produit, les traductions, les embeddings, la modération et l'archivage d'une organisation. Le document est reconstruit depuis la base à chaque passage : idempotent et rejouable.
- **Commande** `node ace search:reindex` : reconstruction complète par lots, dans un index temporaire échangé atomiquement.
- Détail : [`docs/search.md`](../search.md).
