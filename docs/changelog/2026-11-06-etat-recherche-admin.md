# État de la recherche Meilisearch et réindexation (administration)

> Date : 2026-11-06

Issue #176 : l'équipe admin voit l'état de l'index, mesure son écart avec PostgreSQL, relance une réindexation et évalue la pertinence sans passer par `node ace search:reindex` / `search:evaluate`.

## Droit et navigation

Nouveau droit `search.manage`, porté par le seul rôle `admin`. 403 pour les autres rôles plateforme ; onglet « Recherche » masqué.

## Écrans et routes

- `GET /:locale/admin/search` (`admin.search.index`, `SearchController`) : statut du moteur, historique des réindexations et des évaluations (10 dernières de chaque), écart PostgreSQL ↔ index à la demande. La page se rafraîchit toutes les 2 s tant qu'une opération est en cours.
- `POST /:locale/admin/search/reindex` (`admin.search.reindex`) : met en file une réindexation. Corps optionnel `supplierId` : sans lui, tout le catalogue ; avec lui, les produits de ce fournisseur seulement. Audit `search.reindex_requested`.
- `POST /:locale/admin/search/evaluate` (`admin.search.evaluate`) : met en file l'évaluation de pertinence. Audit `search.evaluation_requested`.
- Tableau de bord (`GET /admin`) : prop `searchDisabled`, vraie quand `MEILISEARCH_HOST` est absent et que le rôle porte `search.manage` ; une alerte renvoie vers l'écran.

## Statut

Trois états. **Désactivée** : pas de `MEILISEARCH_HOST`, rien n'est indexé (jusqu'ici sans aucune alerte). **Injoignable** : la sonde échoue ou ne répond pas sous 5 s ; le message du moteur est affiché. **Active** : documents, écritures en cours, vectorisation (fournisseur et modèle), poids du sémantique et dix dernières tâches Meilisearch avec leur erreur. Un index absent (jamais réindexé) est signalé à part.

## Écart PostgreSQL ↔ index

Compare les produits visibles (mêmes règles que la fiche publique) aux identifiants de l'index : nombre attendu et indexé, produits manquants et en trop avec 20 exemples de chaque. Le calcul parcourt tout le catalogue : il est lancé par le bouton « Vérifier l'écart » (rechargement partiel de la prop `drift`), jamais au chargement de la page.

## Opérations asynchrones

Table `search_runs` (migration `1794000000007`) : `kind` (`reindex` / `evaluation`), `status` (`pending`, `running`, `completed`, `failed`), périmètre, `processed` / `total` (produits parcourus), `result` (JSON), erreur, auteur, dates. Traitées par `SearchRunJob`, sans nouvel essai automatique.

- Une seule opération d'un même type à la fois ; une demande pendant ce temps est refusée. Une opération restée « en cours » plus de 2 h (worker tué) ne bloque plus.
- Une réindexation complète construit l'index à côté puis l'échange : un échec laisse l'ancien en place. Celle d'un fournisseur réécrit seulement ses produits.
- Une évaluation conserve le rappel@10, les compteurs, les latences p50 / p95 et les requêtes en échec.

## Points d'attention

- Migration à appliquer : `node ace migration:run`.
- Les 7 langues autres que le français et l'anglais reçoivent le texte anglais pour les clés admin.
- `SearchEngine` gagne deux méthodes abstraites, `inspect` et `documentIds` ; `FakeSearchEngine` (tests) les implémente.
