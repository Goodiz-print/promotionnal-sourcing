# Menu latéral : ouverture au survol

> Date : 2026-11-11

Quand le menu latéral de l'application est réduit (rail d'icônes, dès `md`),
le survoler le **déplie temporairement** par-dessus le contenu, puis il se
replie quand le pointeur en sort.

- **Aperçu sans décalage** : la grille du layout (`inertia/layouts/default.vue`)
  garde la largeur du rail ; seule la colonne s'élargit (264 px) avec une ombre,
  au-dessus de la page.
- **Délai de 150 ms** avant l'ouverture : traverser le rail avec le pointeur ne
  le déplie pas.
- **Choix mémorisé inchangé** : l'aperçu ne touche pas à `app-sidebar-collapsed`
  (`localStorage`). Pendant l'aperçu, le bouton propose toujours « Déplier le
  menu » pour le garder ouvert ; cliquer sur réduire/déplier ferme l'aperçu en cours.
- **Code** : composable `useSidebarPeek` (`inertia/composables/use_sidebar_peek.ts`),
  prop `peek` de `AppSidebar`. Tests : `tests/inertia/use_sidebar_peek.spec.ts`.
