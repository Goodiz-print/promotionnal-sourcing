# Design system applicatif dérivé de la landing

> Date : 2026-10-29

Refonte visuelle de la partie applicative sur le langage de la landing (`docs/design-system.md` réécrit, `docs/charte-graphique.md` mis à jour).

## Fondations (`inertia/css/`)

- `app.css` : suppression du reset `* { margin: 0; padding: 0 }` non layeré qui, en Tailwind v4 (utilitaires dans `@layer utilities`), annulait tous les `p-*`/`m-*` de l'application ; styles d'éléments déplacés dans `@layer base` (police, titres Manrope, anneau de focus global).
- Polices : Manrope (titres) + Instrument Sans (texte) auto-hébergées via `@fontsource`, pour la landing **et** l'app ; plus de Google Fonts (Inter, IBM Plex Mono) dans `resources/views/inertia_layout.edge`.
- Échelle typographique unique (`text-display-*`, `text-heading-*`, `text-body-*`, `text-caption`, `text-eyebrow`, `text-tabular`) lue depuis `tokens/typography.css` ; les utilitaires `type-*` (inutilisés) sont supprimés.
- `@theme` : couleurs sémantiques exposées en utilitaires (`bg-card`, `bg-sunken`, `bg-brand-subtle`, `border-hairline`, `border-input`, `border-strong`, `text-text-brand`, accents chauds, `rounded-pill`) ; `wrapper`, `field-control`, `shadow-elevation-*`, `text-gradient-brand`, `table-base` disponibles partout. `marketing.css` ne garde que les animations et styles propres à la landing. Token `--gray-5` ajouté (référencé mais indéfini), dégradés de marque déplacés dans `tokens/colors.css`.
- Dépendance `lucide-vue-next` (icônes).

## Composants base (`inertia/components/base/`)

- Refondus : `BaseButton` (variants primary/secondary/ghost/danger/link, tailles sm/md, `block`, `loading`, slot `icon`), `BaseLinkButton` (mêmes variants + `on-dark`, tailles sm/md/lg, `block`), `BaseCard` (`as`, variants default/sunken/brand/dark, `padding`, `hover`), `BaseBadge` (tonalités + `brand`, `dot`), `BaseField` (`hint`, `required`, erreur `role="alert"` + `aria-describedby`), `BaseInput` (slots `prefix`/`suffix`), `BaseSelect` (chevron), `BaseTextarea`, `BaseCheckbox`, `BaseRadioGroup`, `BaseFileInput` (zone de dépôt), `BaseStat` (icône, `href`), `BasePagination`.
- Nouveaux : `BasePageHeader`, `BaseSection`, `BaseTable`, `BaseEmptyState`, `BaseTabs`, `BaseDropdown` (+ composable `useDismissable` : clic extérieur, Échap, navigation), `BaseAlert`, `BaseAvatar`, `BaseIconButton`.
- `inertia/types/ui.ts` : `BadgeTone` partagé (plus de type `Tone` dupliqué dans `components/{rfqs,quotes,orders}/types.ts`), classes communes des boutons ; statut RFQ `closed` en tonalité neutre.

## Shell applicatif

- `inertia/layouts/default.vue` : sidebar (`components/app/app_sidebar.vue`, menu `app_nav.vue` groupé — Explorer / Achats / Espace fournisseur / Organisation / Plateforme — avec icônes lucide, sélecteur d'organisation) + topbar (`components/app/app_topbar.vue` : burger mobile, langue, cloche, menu utilisateur ou connexion / inscription) + contenu sur fond sunken (`max-w-[1180px]`). Sidebar coulissante sur mobile.
- `inertia/layouts/auth.vue` : carte centrée sur fond sunken + halo (`GradientMesh`, désormais statique par défaut, `animated` sur la landing) pour connexion, inscription (classique et agence), mot de passe oublié / réinitialisation, vérification d'e-mail, onboarding, création d'organisation, invitations (`<Head>` ajouté sur les pages auth).
- `user_menu.vue`, `notifications/notification_bell.vue` (icône `Bell`, pastille `data-testid="unread-badge"`), `language_menu.vue`, `organization_switcher.vue` : menus sur `BaseDropdown`/`useDismissable` (plus de `<details>`), tokens DS.
- Pages d'erreur (`errors/not_found`, `errors/server_error`) : `BaseEmptyState` + retour à l'accueil, titres `<Head>`.
- Clés i18n : `common.nav.groups.*`, `common.nav.openMenu`/`closeMenu`/`backToSite`/`logoAlt`, `errors.*.description`, `errors.backHome`, `products.manage.sections.*`, `products.manage.backToList`, `dashboard.supplier.todo.*`, `admin.nav.label`.

## Pages pilotes migrées

Tableau de bord (acheteur : `BaseStat` par statut + dernières réponses ; fournisseur : stats, section « À faire » avec barre de complétude du profil ; admin : `BasePageHeader` + onglets `BaseTabs` via le composable `use_admin_tabs.ts`, qui remplace `components/admin/admin_nav.vue`, supprimé), catalogue (produits, fournisseurs, filtres, cartes), demandes de devis acheteur (liste en `BaseTable`, fiche en `BaseSection`, comparaison des devis), authentification, formulaire produit (`BaseSection as="fieldset"` par groupe, barre d'actions collante) et gestionnaire de documents. Les autres pages conservent leur markup et bénéficient du shell et des composants base rénovés ; elles migrent page par page selon `docs/design-system.md` (« Anatomie d'une page applicative »).

## Tests

`tests/inertia/base_layout_components.spec.ts` (page header, table, empty state, tabs, section, badge, dropdown), groupes dans `app_nav.spec.ts` ; specs existantes adaptées au nouveau DOM (`base_components`, `notification_bell`, `password_reset`, `verify_email`, RFQ, catalogue).
