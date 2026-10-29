# Mémorisation de l'ouverture des filtres

> Date : 2026-10-29

L'état ouvert/fermé de chaque groupe de la barre de filtres du catalogue est mémorisé
automatiquement dans le `localStorage` (clé `catalogue-facets-open`, un objet indexé par
titre du groupe) et restauré aux visites suivantes.

- `useFacetOpen` (`inertia/composables/use_facet_open.ts`) : rendu à `defaultOpen` côté SSR,
  restauration après montage pour éviter un écart d'hydratation.
- Stockage indisponible (navigation privée…) : l'état reste valable pour la session, sans erreur.
- La clé étant le titre affiché, un changement de langue repart des valeurs par défaut.
- Aucun texte nouveau (pas de clé i18n).
