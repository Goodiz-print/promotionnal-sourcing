# Intégration du design system (artéfact claude.ai/design)

> Date : 2026-07-13

Intègre l'artéfact **« Promotional Sourcing Design System »** au frontend :
les tokens de design deviennent la source de vérité des styles.

- **Tokens** (`inertia/css/tokens/`) : `colors.css` (rampe marque **indigo**
  #4032c8 échantillonnée sur le logo + rampe neutre **ink** teintée navy +
  sémantique surfaces/texte/bordures/états/boutons), `typography.css` (échelle
  display/heading/body/eyebrow/tabular, fonte **Inter** substitut de Sohne),
  `spacing.css` (grille 8px, radius, ombres navy, motion, layout).
- **`app.css`** : importe les tokens, les expose à Tailwind v4 via `@theme`
  (utilitaires `bg-indigo-*`, `text-ink-*`, `text-primary`, `shadow-1/2/3`,
  `font-sans` Inter…) et ajoute des utilitaires typographiques `type-*`
  (`type-display-xl`, `type-heading-lg`, `type-body-md`, `type-eyebrow`…).
- **Rétro-compatibilité** : les variables historiques (`--gray-*`, `--primary-*`,
  `--color-primary*`) utilisées par les composants Vue existants sont conservées
  et repointées sur la rampe du design system → adoption sans modifier les
  composants (neutres désormais teintés navy, indigo de marque exact).
- **`inertia_layout.edge`** : chargement de la police Inter/IBM Plex Mono
  (Google Fonts, `preconnect`).
