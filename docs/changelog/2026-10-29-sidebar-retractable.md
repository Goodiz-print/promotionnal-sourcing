# Menu latéral rétractable

> Date : 2026-10-29

Dès `md`, un bouton en tête de la sidebar applicative (`PanelLeftClose` / `PanelLeftOpen`)
réduit la colonne de 264 px à un rail de 72 px : icônes seules (libellé en `title` et
`sr-only`), titres de groupe remplacés par un filet, logo et sélecteur d'organisation
masqués. Le choix est mémorisé dans `localStorage` (`app-sidebar-collapsed`, repli silencieux
si indisponible). Le panneau mobile reste toujours déplié.

- `useSidebarCollapsed` : état partagé layout / sidebar.
- `AppNav` : prop `collapsed`. `AppSidebar` : prop `collapsed`, événement `toggleCollapse`.
- Clés `common.nav.collapseSidebar` / `expandSidebar` dans les 9 langues.
