# Journal des recherches des clients

> Date : 2026-10-31

Issue #171 (epic #157). Chaque recherche significative est enregistrée dans la table `search_events` (migration `create_search_events_table`) : terme normalisé, filtres actifs, catégorie, mode (`semantic`, `keywords`, `unavailable`, `directory`), nombre de résultats (zéro résultat = 0), utilisateur, organisation, langue, date.

- **Surfaces** : catalogue produits (`GET /products`), annuaire fournisseurs (`GET /suppliers`), sélecteur de produit des demandes de devis. Première page seulement ; la simple navigation (ni terme, ni catégorie, ni filtre) n'est pas enregistrée.
- **Asynchrone** : `SearchEventService.record` met `RecordSearchEventJob` en queue ; une erreur d'enregistrement n'impacte jamais la recherche.
- **Rétention / RGPD** : `PurgeDemandEventsJob` (quotidien) détache l'utilisateur et l'organisation après 90 jours, supprime après 365 jours. La politique de confidentialité doit mentionner cette collecte.
- Tests : `tests/unit/search_event.spec.ts`, `tests/functional/search_events.spec.ts`. Factory : `SearchEventFactory`. Détails : `docs/admin.md`.
