# Écran « Ce que cherchent les clients »

> Date : 2026-11-03

Issue #173 (epic #157). Nouvelle section du back-office, onglet « Demande clients » (`GET /admin/demand`, droit `monitoring.view` : `admin` et `analyst`).

- **Contenu** : synthèse, évolution quotidienne, requêtes les plus fréquentes et sans résultat, catégories et filtres les plus utilisés, modes de recherche (sémantique / mots-clés), produits et fournisseurs les plus consultés, produits les plus ajoutés aux demandes de devis.
- **Filtres** : période (30 jours par défaut), écran de recherche, langue, type d'organisation.
- **Export CSV** : `GET /admin/demand/export`, mêmes filtres, protégé contre l'injection de formule.
- **Code** : `AdminDemandService` (agrégations), `Admin/DemandController`, types dans `shared/types/admin_demand.ts`, traductions `admin.demand.*` dans les 9 langues.
- Tests : `tests/functional/admin_demand.spec.ts`. Détails : `docs/admin.md`.
