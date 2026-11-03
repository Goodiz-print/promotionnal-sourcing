# Tableau de bord KPI du back-office

> Date : 2026-11-03

Issue #174 (epic #157). L'accueil `/admin` garde ses compteurs et affiche, pour les rôles qui ont le droit `monitoring.view` (`admin` et `analyst`), des indicateurs sur une période comparés à la période précédente de même durée.

- **Période** : `GET /admin?from=AAAA-MM-JJ&to=AAAA-MM-JJ` (30 derniers jours par défaut, plafond de 366 jours en gardant la fin, fin ramenée à aujourd'hui). Dates invalides ou fin avant le début : erreur de validation.
- **Comptes** : nouvelles organisations (et par type), nouveaux utilisateurs, utilisateurs actifs (`last_login_at`).
- **Demandes de devis** : créées, publiées, délai de publication, taux de réponse et de refus des fournisseurs notifiés, répartition par statut.
- **Devis** : remis, acceptés, refusés, délai de décision. **Commandes** : créées, conversion devis → commande (devis remis dans la période ayant une commande), délai de livraison, volume d'affaires par devise (hors annulées).
- **Catalogue** : produits par statut de cycle de vie, couverture de traduction par langue. **À traiter** : agences à revoir (motifs de revue). La modération n'est pas encore branchée sur les cibles : elle viendra avec #162/#163.
- **Activité quotidienne** : tableau jour par jour (les barres sont décoratives).
- **Rôles sans `monitoring.view`** (support, modérateur) : compteurs seuls (`kpis: null`).
- **Code** : `AdminKpiService`, `Admin/DashboardController`, `adminPeriodValidator`, types dans `shared/types/admin_kpi.ts`, composants `inertia/components/admin/kpi_*`, traductions `admin.dashboard.kpi.*`.
- **Cache** : aucun pour l'instant (agrégations bornées par la période et par les index existants) ; à ajouter si l'écran devient coûteux.
- Tests : `tests/functional/admin_dashboard.spec.ts`.
