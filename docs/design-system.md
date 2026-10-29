# Design System — promotionalsourcing.eu

> Un seul langage visuel pour la landing et l'application, **dérivé de la landing** : Manrope pour les titres, Instrument Sans pour le texte, boutons pill indigo, cartes blanches `rounded-xl` à bordure hairline sur fond « sunken », eyebrows, chips indigo clair, chiffres tabulaires.
> Ce document complète [`charte-graphique.md`](charte-graphique.md) (logo, favicon, règles de marque). En cas de divergence, les fichiers sous `inertia/css/` font foi.

**Sources** : tokens `inertia/css/tokens/{colors,typography,spacing}.css` → exposés à Tailwind v4 par `@theme` dans `inertia/css/app.css` (utilitaires `bg-card`, `text-text-secondary`, `border-hairline`, `rounded-pill`, `font-heading`, `shadow-elevation-*`, `text-display-*`…). `inertia/css/marketing.css` ne contient plus que les animations et styles propres à la landing.

## Principes

1. **Fond sunken, cartes blanches.** Une page applicative est posée sur `bg-sunken` (`--ink-50`) ; le contenu vit dans des cartes `bg-card` à bordure `hairline` et ombre `elevation-1`. Jamais de bordure `--gray-*` seule sur fond blanc.
2. **L'indigo est un accent.** Une seule action primaire par écran. Le reste en secondaire (bordure), ghost (indigo clair) ou lien.
3. **Pill pour l'action, arrondi pour le contenu.** Boutons, chips et badges en `rounded-pill` ; champs, menus et vignettes en `rounded-md`/`rounded-lg` ; cartes en `rounded-xl`.
4. **Manrope titre, Instrument Sans texte.** Tout titre (`h1`-`h6`, utilitaires `text-display-*`/`text-heading-*`/`text-eyebrow`) est en Manrope 600 ; le texte courant en Instrument Sans. Chiffres et prix en `text-tabular`.
5. **Icônes lucide** (`lucide-vue-next`), trait 1.5-2 px, 18 px dans les boutons et menus, 20 px dans la topbar, 16 px en inline. Jamais d'emoji ni de glyphe texte (`→`, `☰`) dans l'app.
6. **Accessibilité clavier** : anneau de focus global (`app.css`, `@layer base`) — ne pas le neutraliser (`outline-none`) sans alternative visible.
7. **Rien hors layer.** Les styles d'éléments vivent dans `@layer base` : une règle non layerée écrase les utilitaires Tailwind (c'était le bug de l'ancien reset `* { margin: 0; padding: 0 }`).

## Tokens

### Couleurs (`tokens/colors.css`)

| Rôle                                                    | Utilitaire Tailwind                                                | Variable                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------- |
| Fond de page                                            | `bg-sunken`                                                        | `--surface-sunken` (`--ink-50`)                   |
| Carte, menu, champ                                      | `bg-card` / `bg-canvas`                                            | `--surface-card` / `--surface-canvas` (blanc)     |
| Bordure de carte, séparateur                            | `border-hairline`                                                  | `--border-hairline` (`--ink-100`)                 |
| Bordure de champ, bouton secondaire                     | `border-input`, hover `border-strong`                              | `--border-input` (`--ink-200`), `--border-strong` |
| Texte principal / secondaire / discret                  | `text-text-primary` / `text-text-secondary` / `text-text-muted`    | `--ink-950` / `--ink-600` / `--ink-400`           |
| Marque                                                  | `bg-indigo-500`, `text-indigo-600`, `text-text-brand`              | `--indigo-*`                                      |
| Fond indigo clair (chips, item actif, pastille d'icône) | `bg-brand-subtle`                                                  | `--surface-brand-subtle` (`--indigo-50`)          |
| États                                                   | `text-success`/`bg-success-bg`, `warning`, `danger`, `info`        | `--state-*`                                       |
| Dégradé de marque (bannière CTA, un mot du hero)        | `text-gradient-brand`, `style="background: var(--gradient-brand)"` | `--gradient-brand`                                |

Les alias historiques `--gray-*`, `--primary-*`, `--color-primary*` restent définis pour les pages non migrées : **ne plus les utiliser dans du code neuf**.

### Typographie (`tokens/typography.css`)

| Utilitaire         | Police / taille / graisse             | Usage                                                                |
| ------------------ | ------------------------------------- | -------------------------------------------------------------------- |
| `text-display-xl`  | Manrope 68 / 600 / -0.03em            | Hero landing                                                         |
| `text-display-lg`  | Manrope 40 / 600 / -0.02em            | Titre de section landing, H1 des pages marketing                     |
| `text-display-md`  | Manrope 32 / 600 / -0.015em           | **H1 des pages applicatives** (`BasePageHeader`), titres auth        |
| `text-heading-lg`  | Manrope 19 / 600                      | Titre de grande carte                                                |
| `text-heading-md`  | Manrope 16 / 600                      | Titre de section/carte (`BaseSection`)                               |
| `text-heading-sm`  | Manrope 15 / 600                      | Titre de bloc secondaire, en-tête de menu                            |
| `text-body-lg`     | 19 / 400                              | Intro sous un titre display                                          |
| `text-body-md`     | 15 / 400                              | Corps de texte, boutons md, champs                                   |
| `text-body-sm`     | 14 / 400                              | Navigation, tableaux, descriptions, boutons sm                       |
| `text-caption`     | 13 / 400                              | Métadonnées, labels de stats, badges                                 |
| `text-eyebrow`     | Manrope 13 / 700 / 0.06em, majuscules | Sur-titre (`text-text-brand`) ou titre de groupe (`text-text-muted`) |
| `text-tabular`     | `tnum`                                | Prix, quantités, compteurs, dates                                    |
| `text-stat-figure` | Manrope 40 / 600                      | Chiffres clés de la landing                                          |

Pas de `text-[NNpx]` arbitraire dans du code neuf : choisir le token le plus proche.

### Espacements, rayons, ombres, motion (`tokens/spacing.css`)

- Grille 8 px via les utilitaires Tailwind (`gap-4`, `p-6`…).
- Rayons : `rounded-xs` 4 · `rounded-sm` 6 · `rounded-md` 8 · `rounded-lg` 12 · `rounded-xl` 16 · `rounded-pill`.
- Ombres : `shadow-elevation-1` (cartes au repos) · `-2` (menus, cartes survolées) · `-3` (panneau mobile, mockup).
- Transitions : 150-200 ms, `ease-out` ; aucune animation décorative dans l'app (`anim-*`, `data-reveal`, canvas restent à la landing).

## Recettes

| Élément                                    | Classes                                                                                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Conteneur de page                          | layout `default.vue` : `mx-auto w-full max-w-[1180px] px-4 py-6 md:px-8 md:py-8` ; la page enchaîne ses blocs avec `flex flex-col gap-8`                     |
| Carte                                      | `rounded-xl border border-hairline bg-card shadow-elevation-1` (+ `hover:shadow-elevation-2` si cliquable) → `BaseCard`                                      |
| Ligne de liste                             | `flex items-center gap-3.5 rounded-xl border border-hairline bg-card p-3` + vignette `rounded-md bg-sunken`                                                  |
| Pastille d'icône                           | `flex size-10 items-center justify-center rounded-[10px] bg-brand-subtle text-indigo-600`                                                                    |
| Chip de marque                             | `rounded-pill bg-brand-subtle px-2.5 py-0.5 text-caption font-semibold text-indigo-600` → `BaseBadge tone="brand"`                                           |
| Champ                                      | `field-control h-11` (bordure input, focus indigo-300 + halo `brand-subtle`, erreur via `data-invalid`)                                                      |
| Titre de groupe (sidebar, filtres, aside)  | `text-eyebrow text-text-muted`                                                                                                                               |
| Lien d'action                              | `text-body-sm font-semibold text-indigo-600 hover:underline`                                                                                                 |
| Prix                                       | `text-tabular font-semibold text-indigo-600`                                                                                                                 |
| Bannière CTA                               | `rounded-xl p-8 text-white` + `style="background: var(--gradient-brand)"` + disque `absolute -top-24 -right-24 size-64 rounded-full bg-white opacity-[0.12]` |
| Barre d’actions collante (long formulaire) | `sticky bottom-4 z-20 flex items-center justify-end gap-3 rounded-xl border border-hairline bg-white/90 px-4 py-3 shadow-elevation-2 backdrop-blur-md`       |

## Composants (`inertia/components/base/`)

Obligatoires dès qu'ils s'appliquent — ne pas recopier leur markup.

| Composant                                         | Props principales                                                                                   | Slots                                          | Rôle                                                                                           |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `BaseButton`                                      | `variant` primary·secondary·ghost·danger·link, `size` sm·md, `block`, `loading`, `disabled`, `type` | défaut, `icon`                                 | Bouton pill                                                                                    |
| `BaseLinkButton`                                  | `href`, `variant` (+ `on-dark`), `size` sm·md·lg, `block`                                           | défaut                                         | Lien stylé en bouton (Inertia si chemin interne)                                               |
| `BaseIconButton`                                  | `label` (aria), `active`                                                                            | défaut (icône)                                 | Bouton carré d'icône (topbar, actions de ligne)                                                |
| `BaseCard`                                        | `as`, `variant` default·sunken·brand·dark, `padding` none·sm·md·lg, `hover`                         | défaut                                         | Carte                                                                                          |
| `BaseSection`                                     | `title`, `description`, `flush`, `as` section·div·fieldset                                          | défaut, `actions`, `footer`                    | Carte à en-tête : pages détail, groupes de champs                                              |
| `BasePageHeader`                                  | `title`, `description`, `eyebrow`, `backHref`/`backLabel`                                           | `meta`, `actions`                              | En-tête de page (H1 `text-display-md`)                                                         |
| `BaseTable`                                       | `caption`                                                                                           | `head`, défaut, `foot`                         | Tableau `table-base` dans un conteneur arrondi ; cellules numériques `text-tabular text-right` |
| `BaseEmptyState`                                  | `title`, `description`, `icon`, `compact`                                                           | `actions`                                      | État vide                                                                                      |
| `BaseTabs`                                        | `items[{href,label,active,count?}]`, `label`                                                        | `actions`                                      | Onglets de navigation soulignés                                                                |
| `BaseDropdown`                                    | `align`, `width` ; émet `open`/`close`                                                              | `trigger{open,toggle}`, défaut `{close}`       | Menu refermé au clic extérieur / Échap / navigation (`useDismissable`)                         |
| `BaseBadge`                                       | `tone` neutral·info·brand·success·warning·danger, `dot`                                             | défaut                                         | Pastille de statut (tonalités dans `inertia/types/ui.ts`)                                      |
| `BaseAlert`                                       | `tone`, `title`                                                                                     | défaut                                         | Encart d'information                                                                           |
| `BaseAvatar`                                      | `initials`, `size` sm·md·lg                                                                         | —                                              | Avatar initiales                                                                               |
| `BaseStat`                                        | `label`, `value`, `hint`, `icon`, `href`                                                            | —                                              | Compteur de tableau de bord                                                                    |
| `BaseField`                                       | `label`, `htmlFor`, `error`, `hint`, `required`                                                     | défaut `{errorId,hintId}`                      | Enveloppe label / aide / erreur (`role="alert"`, `aria-describedby`)                           |
| `BaseInput` / `BaseSelect` / `BaseTextarea`       | `id`, `v-model`, `label`, `error`, `hint`, `required`, `disabled`…                                  | `prefix`/`suffix` (input), `<option>` (select) | Champs `field-control`                                                                         |
| `BaseCheckbox`, `BaseRadioGroup`, `BaseFileInput` | idem                                                                                                | —                                              | Cases, cartes radio, zone de dépôt                                                             |
| `BasePagination`                                  | `meta`, `previousLabel`, `nextLabel` ; émet `change`                                                | —                                              | Pager                                                                                          |

Correspondances statut → tonalité : `inertia/components/{rfqs,quotes,orders}/types.ts` (type `BadgeTone` de `inertia/types/ui.ts`).

## Shell applicatif

- `inertia/layouts/default.vue` : grille `md:grid-cols-[264px_1fr]` sur `bg-sunken`. Sidebar (`components/app/app_sidebar.vue` : logo, `app_nav.vue` groupé avec icônes, sélecteur d'organisation), topbar (`components/app/app_topbar.vue` : burger mobile, langue, cloche, menu utilisateur). Sur mobile la sidebar coulisse (`-translate-x-full`) sous un voile.
- `inertia/layouts/auth.vue` : carte centrée `max-w-[460px]` sur fond sunken + `GradientMesh` statique — connexion, inscription, onboarding, création d'organisation, invitations (`defineOptions({ layout: AuthLayout })`).
- `inertia/layouts/marketing.vue` : landing (inchangé).

## Anatomie d'une page applicative

```vue
<Head :title="t('rfq.index.title')" />
<div class="flex flex-col gap-8">
  <BasePageHeader :title="…" :description="…">
    <template #actions><BaseLinkButton :href="…">Nouvelle demande</BaseLinkButton></template>
  </BasePageHeader>

  <BaseEmptyState v-if="items.length === 0" :title="…" :description="…" />
  <BaseTable v-else>…</BaseTable>   <!-- ou une grille de BaseCard / BaseSection -->
</div>
```

- Page détail : `BasePageHeader` (avec `backHref`, `meta` = badges) puis des `BaseSection` ; infos clés en `grid gap-x-6 gap-y-3 sm:grid-cols-2` de `<dt class="text-caption font-semibold text-text-muted">` / `<dd class="text-body-sm">`.
- Formulaire : `<form class="flex flex-col gap-6">`, un `BaseSection as="fieldset"` par groupe, champs en `grid gap-5 sm:grid-cols-2`, barre d'actions à droite (`flex justify-end gap-3`) ou collante pour les formulaires longs.
- Liste de cartes : `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`.

## À ne pas faire

- `text-[32px]`, `tracking-[-0.5px]`, `rounded` nu, `border-[var(--gray-3)]`, `text-[var(--gray-6)]`, `#fb2c36` : utiliser les tokens et composants ci-dessus.
- Un `<h1>` ou un `<table>` à la main : `BasePageHeader`, `BaseTable`.
- `<details>` pour un menu : `BaseDropdown`.
- Transposer dans l'app les animations de la landing (`anim-*`, `data-reveal`, `FxCanvas`), les ombres colorées des CTA, les fonds d'icônes saturés ou plusieurs couleurs dans un titre.

## Étendre

- Nouveau token → `inertia/css/tokens/*.css`, exposé dans `@theme` (`app.css`) si un utilitaire est nécessaire, puis ce document.
- Nouveau composant générique → `inertia/components/base/base_*.vue` + test dans `tests/inertia/` + ligne dans le tableau ci-dessus.
- Nouvelle page → anatomie ci-dessus ; une page existante se migre en remplaçant son en-tête, ses cartes et tableaux par les composants base.
