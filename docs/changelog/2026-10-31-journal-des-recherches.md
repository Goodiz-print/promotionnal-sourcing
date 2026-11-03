# Journal des recherches des clients

> Date : 2026-10-31

Issue #171. Chaque recherche significative d'un client est désormais enregistrée, de façon asynchrone, pour pouvoir analyser plus tard ce que les clients cherchent (écran « Ce que cherchent les clients », #173). Les données passées ne se rattrapent pas : l'instrumentation passe en premier.

- **Table `search_events`** (migration `…create_search_events_table`) : source, terme normalisé, filtres (`jsonb`), catégorie, mode (`semantic` / `keyword` / `unavailable` / `browse`), nombre de résultats, drapeau `zero_results`, utilisateur, organisation, langue, date.
- **Sources** : le catalogue (`ProductsController#index`), l'annuaire des fournisseurs (`SuppliersController#index`) et le sélecteur de produit des demandes de devis (`RfqsController`, partial reload).
- **Asynchrone et sans effet de bord** : `SearchEventService` met un `RecordSearchEventJob` en file ; une file indisponible n'empêche jamais la recherche.
- **Pas de doublon** : seule la première page compte (pagination et tri ignorés), l'ouverture nue du catalogue n'écrit rien, et un utilisateur connecté qui rejoue la même recherche dans les 30 secondes n'écrit qu'une ligne.
- **Mode réel** : `ProductSearchService.search` accepte un `SearchTrace` optionnel et y reporte le mode utilisé, y compris le repli en mots-clés quand l'API d'embeddings échoue.
- **RGPD** : `PurgeSearchEventsJob` (chaque nuit) détache les événements de plus de 90 jours de leur utilisateur et supprime ceux de plus de 24 mois ; la politique de confidentialité est mise à jour dans les 9 langues (collecte, base légale, durées).
- Tests : `tests/functional/search_events.spec.ts`. Documentation : `docs/search.md` (« Journal des recherches »).
