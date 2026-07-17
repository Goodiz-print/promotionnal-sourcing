# Design System — promotionalsourcing.eu

> Référence visuelle : sobriété façon [stripe.com](https://stripe.com/en-fr) — fond dominant blanc, neutres teintés navy pour le texte/les bordures, indigo de marque en accent réservé aux actions.
> Ce document complète [`charte-graphique.md`](charte-graphique.md) (logo, favicon, règles de marque) avec les tokens et patterns de composants réutilisables. En cas de divergence, les fichiers sous `inertia/css/tokens/` font foi — ce sont eux qui sont réellement chargés par l'app.

> **Source des tokens** : `inertia/css/tokens/{colors,typography,spacing}.css`, importés par `inertia/css/app.css` qui les expose à Tailwind v4 via `@theme` (utilitaires `bg-indigo-*`, `text-ink-*`, `shadow-1/2/3`, `font-sans`…) et définit les utilitaires typographiques `type-*`. Intégration de l'artéfact **« Promotional Sourcing Design System »** (claude.ai/design) — voir `docs/changelog.md` (2026-07-13).

## Principes

1. **Le blanc/gris domine, l'indigo est rare.** Une seule action indigo par écran dans l'idéal (le CTA principal).
2. **Ombres subtiles, jamais lourdes.** Les tokens `--shadow-1/2/3` (teintés navy, jamais noir pur) existent pour les éléments qui se détachent du flux (menus, modales, cartes surélevées) ; pour les séparations simples, préférer les bordures fines (`--border-hairline`/`--border-strong`, alias legacy `--gray-3`/`--gray-4`).
3. **Rayons discrets.** `--radius-xs`/`--radius-sm` (4-6px) pour inputs/boutons/cartes — jamais `--radius-pill`/`--radius-xl` sauf avatars/pastilles.
4. **Accessibilité clavier obligatoire.** Tout élément interactif a un anneau de focus visible (`focus-visible:outline-2 outline-offset-2 outline-[var(--primary-6)]`, ou `--shadow-focus-ring`).
5. **Tokens via variables CSS**, pas de couleurs codées en dur — utiliser `var(--ink-*)`, `var(--indigo-*)`, `var(--text-*)`/`var(--surface-*)`/`var(--state-*)`, ou leurs alias historiques `var(--gray-*)`/`var(--primary-*)`/`var(--color-primary*)` déjà répandus dans le code existant.

## Tokens

### Couleurs

Définis dans `inertia/css/tokens/colors.css`. Rampe **indigo** (marque, `#4032c8`, échantillonnée sur le logo) + rampe neutre **ink** teintée navy (jamais gris pur) + tokens sémantiques (surfaces, texte, bordures, états, boutons). Détail marque/logo dans [`charte-graphique.md`](charte-graphique.md#couleurs).

| Rôle                      | Token sémantique                                    | Alias historique (composants existants)  |
| ------------------------- | --------------------------------------------------- | ---------------------------------------- |
| Fond de page              | `--surface-canvas`/`--surface-sunken`               | `--gray-1` / `--gray-2`                  |
| Bordures, séparateurs     | `--border-hairline`/`--border-strong`               | `--gray-3` / `--gray-4`                  |
| Texte secondaire          | `--text-secondary`/`--text-muted`                   | `--gray-6` / `--gray-7`                  |
| Texte principal           | (entre `--text-secondary` et `--text-primary`)      | `--gray-8` / `--gray-10`                 |
| Titres, texte fort        | `--text-primary`                                    | `--gray-12`                              |
| Marque / CTA              | `--surface-brand` (`--indigo-500`)                  | `--color-primary` (`--primary-9`)        |
| Marque hover/active       | `--btn-primary-bg-hover` (`--indigo-600`)           | `--color-primary-hover` (`--primary-10`) |
| Texte violet renforcé     | `--indigo-700`                                      | `--primary-11`                           |
| Anneau de focus           | `--border-input-focus` (`--indigo-500`)             | `--primary-6` (`--indigo-400`)           |
| Fond badge/callout indigo | `--surface-brand-subtle`/`--indigo-100`             | `--primary-3`                            |
| Fond très subtil (survol) | `--surface-brand-subtle` (`--indigo-50`)            | `--primary-1`                            |
| Texte sur fond indigo     | `--text-on-brand` (blanc)                           | `--color-primary-contrast`               |
| Erreur / destructif       | `--state-danger`/`--color-danger` (`--ruby-500`)    | ancien : `#fb2c36` en dur                |
| Succès                    | `--state-success`/`--color-success` (`--green-500`) | ancien : `#00a63e` en dur                |
| Avertissement             | `--state-warning`/`--color-warning` (`--amber-500`) | _(nouveau, pas d'équivalent avant)_      |

Les tokens sémantiques `--state-*`/`--color-danger`/`--color-success` sont **désormais disponibles** (colonne « alias historique » = ce que le code existant utilise encore en attendant une migration progressive — ne pas réinventer une valeur en dur, préférer le token sémantique pour tout nouveau composant).

### Typographie

- Police : **Inter** (400-700) + **IBM Plex Mono** (chiffres/prix/réf.), chargées via Google Fonts dans `resources/views/inertia_layout.edge` (`--font-sans`/`--font-mono`, `inertia/css/tokens/typography.css`). Substitut de Sohne (propriétaire).
- `<html>`/`<body>` : `font-size: 16px`, `line-height: 1.5`, `font-feature-settings: 'ss01'`, couleur `--text-primary`.
- Titres en `--text-primary`, `font-weight: 600`.

**Échelle de tokens** (`inertia/css/tokens/typography.css`), exposée via les utilitaires `type-*` de `app.css` (`type-display-xl`, `type-heading-md`, `type-body-sm`, `type-eyebrow`, `type-tabular`, `type-caption`…) — à utiliser pour tout **nouveau** composant :

| Utilitaire        | Taille / poids / tracking                   | Usage                                   |
| ----------------- | ------------------------------------------- | --------------------------------------- |
| `type-display-xl` | 56px / 600 / `-0.02em`                      | Hero, titre de page d'accueil           |
| `type-display-lg` | 40px / 600 / `-0.015em`                     | Titre de section majeure                |
| `type-display-md` | 30px / 600 / `-0.01em`                      | Titre de formulaire (login/signup)      |
| `type-heading-lg` | 22px / 600 / `-0.005em`                     | Sous-titre hero                         |
| `type-heading-md` | 18px / 600                                  | Titre de carte                          |
| `type-heading-sm` | 15px / 600                                  | Titre de bloc secondaire                |
| `type-body-lg`    | 17px / 400                                  | Sous-titre de formulaire                |
| `type-body-md`    | 15px / 400                                  | Corps de texte standard                 |
| `type-body-sm`    | 13px / 400                                  | Texte secondaire, aide                  |
| `type-tabular`    | 14px / 500, `font-feature-settings: 'tnum'` | Prix, quantités, SKU (chiffres alignés) |
| `type-button`     | 15px / 500                                  | Libellé de bouton                       |
| `type-caption`    | 13px / 400, couleur `--text-muted`          | Légende, texte d'aide                   |
| `type-eyebrow`    | 12px / 600 / `0.06em`, uppercase            | Sur-titre, badge de section             |

> **État de migration** : les pages/composants existants (`inertia/pages/**`, `inertia/components/**`) utilisent encore des tailles arbitraires Tailwind (`text-[52px]`, `text-[32px]`…) plutôt que les utilitaires `type-*` — c'est le pattern d'origine, pas encore migré vers les tokens ci-dessus. **Pour du code neuf, préférer `type-*`** ; ne pas réinventer une valeur arbitraire proche d'un token existant. Correspondance observée dans le code actuel :

| Usage                              | Classe actuelle (à migrer vers `type-*` à l'occasion)                                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| Titre hero (page d'accueil)        | `text-[52px] leading-[1.05] font-semibold tracking-[-1px]` → proche de `type-display-xl` |
| Titre de formulaire (login/signup) | `text-[32px] tracking-[-0.5px]` → proche de `type-display-md`                            |
| Sous-titre hero                    | `text-[22px] text-[var(--gray-7)]` → proche de `type-heading-lg`                         |
| Sous-titre formulaire              | `text-lg text-[var(--gray-6)]`                                                           |
| Titre de carte                     | `text-xl font-semibold tracking-[-0.4px]` → proche de `type-heading-md`                  |
| Label de champ                     | `text-sm font-medium`                                                                    |
| Message d'erreur de champ          | `text-sm font-medium text-[#fb2c36]` → migrer vers `text-[var(--color-danger)]`          |

Les gros titres portent systématiquement un `letter-spacing` légèrement négatif.

### Espacements, rayons, ombres

`inertia/css/tokens/spacing.css` — grille de base **8px**, exposée en variables CSS (pas encore en utilitaires Tailwind dédiés ; utiliser `var(--space-*)` en style inline/arbitrary value `mb-[var(--space-lg)]`, ou continuer les valeurs Tailwind arbitraires existantes tant qu'un composant n'est pas migré) :

| Token         | Valeur | Token radius    | Valeur | Token ombre           | Usage                                     |
| ------------- | ------ | --------------- | ------ | --------------------- | ----------------------------------------- |
| `--space-2xs` | 2px    | `--radius-xs`   | 4px    | `--shadow-1`          | Cartes au repos, inputs focus             |
| `--space-xs`  | 4px    | `--radius-sm`   | 6px    | `--shadow-2`          | Dropdowns, popovers                       |
| `--space-sm`  | 8px    | `--radius-md`   | 8px    | `--shadow-3`          | Modales                                   |
| `--space-md`  | 12px   | `--radius-lg`   | 12px   | `--shadow-focus-ring` | Anneau de focus (alternative à `outline`) |
| `--space-lg`  | 16px   | `--radius-xl`   | 16px   |                       |                                           |
| `--space-xl`  | 24px   | `--radius-pill` | 9999px |                       | Avatars, pastilles uniquement             |
| `--space-2xl` | 32px   |                 |        |                       |                                           |
| `--space-3xl` | 48px   |                 |        |                       |                                           |
| `--space-4xl` | 64px   |                 |        |                       |                                           |
| `--space-5xl` | 96px   |                 |        |                       |                                           |

Motion : `--duration-fast/base/slow` (120/180/280ms) + `--ease-standard`/`--ease-out` pour toute transition/animation.

**État de migration** (même remarque que la typographie) : le code existant utilise encore les valeurs arbitraires Tailwind par défaut (`px-12.5 py-25`, `gap-6`, `mb-3.75`…) plutôt que `var(--space-*)`. Ne pas créer de nouvelle valeur arbitraire si un token `--space-*`/`--radius-*` correspond déjà.

- Formulaires : `gap-6` entre champs, `mb-1` entre label et input.
- Sections de page : `px-12.5 py-25` (hero), `px-10 py-7.5` (cartes de la grille d'accueil).
- Conteneurs de formulaire centrés : `max-w-[400px] mx-auto`.
- Bordure standard : `border border-[var(--gray-4)]` (inputs/selects) ou `border-[var(--gray-3)]` (séparateurs de layout) — équivalents `--border-input`/`--border-hairline`.

## Composants

Patterns actuels du code (`inertia/pages/**`) — utilisent encore les alias historiques (`--gray-*`, `--color-primary*`), qui résolvent désormais vers la rampe indigo/ink. Base à respecter pour tout nouveau composant, en migrant vers les tokens sémantiques quand c'est naturel (ex. `text-[var(--color-danger)]` plutôt que `#fb2c36`).

### Bouton primaire

```html
<button
  type="submit"
  class="w-full cursor-pointer rounded bg-[var(--color-primary)] p-2.5 font-medium text-[var(--color-primary-contrast)] hover:bg-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
>
  Label
</button>
```

- `disabled` géré via l'état `processing` de `useForm`/`<Form>` — ne pas dupliquer la logique de désactivation.
- Variante non pleine largeur : retirer `w-full`.

### Champ de formulaire (input + label + erreur)

```html
<div>
  <label for="email" class="mb-1 block text-sm font-medium">{{ t('auth.fields.email') }}</label>
  <input
    id="email"
    type="email"
    name="email"
    :data-invalid="errors.email ? 'true' : undefined"
    class="h-10 w-full rounded border border-[var(--gray-4)] px-4 data-[invalid=true]:border-[var(--color-danger)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
  />
  <div v-if="errors.email" class="mt-0.5 text-sm font-medium text-[var(--color-danger)]">
    {{ errors.email }}
  </div>
</div>
```

- Toujours `h-10`, `px-4`, `rounded`, bordure `--gray-4`.
- L'état d'erreur passe par `data-invalid` (pas de classe conditionnelle en JS) + variant Tailwind `data-[invalid=true]:`.
- Un formulaire multi-champs = `<Form>` (`@adonisjs/inertia/vue`) avec `class="flex flex-col gap-6"`, jamais de gestion manuelle de soumission/CSRF (cf. règle globale `CLAUDE.md`).

### Select

```html
<select
  class="cursor-pointer rounded border border-[var(--gray-4)] bg-white px-2 py-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
>
  ...
</select>
```

### Carte de navigation (grille de liens)

```html
<a class="border-r border-l border-[var(--gray-3)] px-10 py-7.5 hover:bg-[var(--gray-1)]">
  <h3 class="mb-2.5 text-xl font-semibold tracking-[-0.4px]">Titre &nbsp;›</h3>
  <p class="text-[var(--gray-6)]">Description</p>
</a>
```

- Fond blanc par défaut, `hover:bg-[var(--gray-1)]` (jamais d'indigo en fond de carte).
- Bordures fines entre cartes plutôt que gap + ombre ; réserver `shadow-1`/`shadow-2` aux cartes réellement surélevées (ex. survol d'une carte produit détachée du flux).

### Focus visible (règle transverse)

Tout élément interactif (bouton, lien fort, input, select) porte :

```
focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]
```

### Label accessible masqué

```html
<label class="sr-only" for="locale-switcher">…</label>
```

## Layout & responsive

- Pas de breakpoints custom déclarés — utiliser les breakpoints Tailwind v4 par défaut (`sm`, `md`, `lg`, `xl`, `2xl`) au besoin ; aucune page actuelle n'en définit encore, donc pas de convention à copier tel quel — décider au cas par cas en restant cohérent avec l'échelle d'espacement ci-dessus.
- Conteneurs de formulaire : centrés, largeur max `400px`.
- Conteneurs de contenu éditorial (hero, etc.) : largeur max `880px` (proche de `--container-max: 1280px` pour les layouts pleine largeur).

## Ce qui n'existe pas encore (ne pas inventer par avance)

- Pas de composants Vue réutilisables de type `Button.vue`/`Input.vue`/`Card.vue`/`Badge.vue`/`Modal.vue` — chaque page réimplémente les classes ci-dessus. Si un composant partagé devient nécessaire (répétition ≥ 3 usages), l'extraire dans `inertia/components/` en respectant strictement ces tokens plutôt que d'introduire de nouvelles valeurs.
- Pas de mode sombre (aucune media query `prefers-color-scheme` dans `inertia/css/tokens/`).
- Pas encore de migration des composants existants vers les utilitaires `type-*`/`var(--space-*)` — ils utilisent les alias historiques et des valeurs arbitraires Tailwind ; c'est acceptable en l'état, mais tout nouveau composant doit préférer les tokens sémantiques du design system.

## Où intervenir pour étendre ce document

- Nouveau composant réutilisable → l'ajouter ici avec son extrait de code une fois qu'il existe réellement dans `inertia/components/`.
- Nouveau token (couleur, espacement, typo) → d'abord dans `inertia/css/tokens/{colors,typography,spacing}.css`, exposé via `@theme`/`@utility` dans `app.css` si besoin d'un utilitaire Tailwind, puis répercuté dans [`charte-graphique.md`](charte-graphique.md) et ce fichier.
