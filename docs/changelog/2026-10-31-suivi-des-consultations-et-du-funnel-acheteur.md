# Suivi des consultations et du funnel acheteur

> Date : 2026-10-31

Issue #172 (epic #157). Table `activity_events` (migration `create_activity_events_table`) : type, cible polymorphe (`product`, `supplier`, `rfq`), utilisateur, organisation, date.

- **Événements** : `product_viewed` (fiche produit), `supplier_viewed` (fiche fournisseur), `rfq_product_added` (ajout d'un produit à un brouillon), `rfq_sent` (envoi de la demande).
- **Exclusions** : visiteurs avec un rôle plateforme, fournisseur qui consulte ses propres fiches, vues répétées d'un utilisateur connecté sur 30 minutes.
- **Asynchrone** : `ActivityEventService.record` met `RecordActivityEventJob` en queue ; une erreur n'impacte jamais l'écran.
- **Rétention** : `PurgeActivityEventsJob` quotidien, pseudonymisation à 90 jours, suppression à 24 mois (comme le journal des recherches de #183).
- **Limite connue** : le clic depuis un résultat de recherche n'est pas encore tracé.
- Tests : `tests/functional/activity_events.spec.ts`. Factory : `ActivityEventFactory`. Détails : `docs/admin.md`.
