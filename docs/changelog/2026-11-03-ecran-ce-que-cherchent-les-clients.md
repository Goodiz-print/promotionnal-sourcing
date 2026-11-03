# Écran admin « Ce que cherchent les clients »

> Date : 2026-11-03

Issue #173 (epic #157). Exploite le journal des recherches (#171) et le suivi des consultations (#172).

- **Routes** : `GET /admin/search` (`admin.search.index`) et `GET /admin/search/export` (`admin.search.export`, CSV). Droit `monitoring.view` : rôles `admin` et `analyst`. Nouvel onglet « Recherches » du back-office.
- **Filtres** : période (30 jours par défaut, 366 au plus), source, langue, type d'organisation.
- **Indicateurs** : total, recherches sans résultat et taux, modes de recherche, comparaison à la période précédente, courbe quotidienne.
- **Classements** : top requêtes, requêtes sans résultat, catégories, filtres les plus utilisés, produits et fournisseurs les plus consultés (avec ajouts à une RFQ).
- **Export CSV** : UTF-8 avec BOM, libellés traduits dans la langue de l'admin, protection contre l'injection de formules (dont tabulation et retour chariot).
- Service : `SearchInsightsService` ; types : `shared/types/search_insights.ts`. Textes traduits dans les 9 langues. Détails : `docs/admin.md`.
