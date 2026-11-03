# Menu latéral du back-office réservé à l'administration

**Date : 2026-11-03**

Dans l'espace administrateur (pages `admin/*`), le menu latéral n'affiche plus les entrées des acheteurs, fournisseurs et agences (demandes de devis, commandes, produits fournisseur, membres, paramètres…). Seule l'entrée « Administration » reste, la navigation entre sections passant par les onglets du back-office.

- Filtre côté front dans `inertia/components/app_nav.vue` (page dont le composant commence par `admin/`).
- Aucun changement de route ni de droit : le menu n'est jamais une autorisation.
