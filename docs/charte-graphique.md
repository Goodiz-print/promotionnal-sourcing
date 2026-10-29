# Charte graphique — promotionalsourcing.eu

Référence visuelle : la landing — fond blanc / gris très clair (« sunken »), cartes blanches arrondies, neutres teintés navy pour le texte/les bordures, indigo en accent réservé aux actions (boutons pill, liens forts, focus, chips), pointes chaudes (orange/ambre) uniquement dans le dégradé de marque.

> Tokens détaillés (typo, espacements, patterns de composants) : voir [`design-system.md`](design-system.md). Ce document reste la référence pour le logo, le favicon et les règles de marque ; en cas de divergence sur les valeurs exactes, `inertia/css/tokens/colors.css` fait foi (source réellement chargée par l'app).

## Logo

- Fichiers sources : `inertia/assets/logo promotional sourcing.png` / `.ai`
- Wordmark noir (`promotional sourcing`) + pastille `.eu` en violet plein avec point blanc
- Toujours sur fond blanc ou très clair (`--ink-0` / `--ink-50`) — ne jamais poser le logo sur un fond violet ou foncé sans version inversée dédiée
- Zone de protection minimale : hauteur du "p" de "promotional" tout autour

## Favicon

- Sources : `inertia/assets/favicon.svg` / `favicon.png` (pastille violette + icône blanche "PS")
- Servies statiquement depuis `public/favicon.svg` et `public/favicon.png` (copiées depuis `inertia/assets`, provider `@adonisjs/static`)
- Déclarées dans `resources/views/inertia_layout.edge` :
  ```html
  <meta name="theme-color" content="#4032c8" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="icon" type="image/png" href="/favicon.png" />
  ```

## Couleurs

### Indigo de marque (issu du logo)

Rampe `--indigo-*` définie dans `inertia/css/tokens/colors.css` (import de `app.css`), exposée à Tailwind par `@theme` (`bg-indigo-500`, `text-indigo-600`…). Aucun alias historique.

| Token CSS      | Usage                                                 | Hex       | RGB             |
| -------------- | ----------------------------------------------------- | --------- | --------------- |
| `--indigo-500` | Couleur de marque, boutons, liens forts               | `#4032C8` | `64, 50, 200`   |
| `--indigo-600` | Hover/active des éléments indigo                      | `#3527AD` | `53, 39, 173`   |
| `--indigo-700` | Texte indigo sur fond clair (contraste renforcé)      | `#2A1E8C` | `42, 30, 140`   |
| `--indigo-400` | Anneaux de focus, états discrets                      | `#6858E0` | `104, 88, 224`  |
| `--indigo-100` | Fond de badge/callout indigo clair                    | `#D6D1F7` | `214, 209, 247` |
| `--indigo-50`  | Fond très subtil (survol de ligne, section highlight) | `#EEECFC` | `238, 236, 252` |
| `--ink-0`      | Texte sur fond indigo                                 | `#FFFFFF` | `255, 255, 255` |

Disponibles comme variables CSS (`var(--indigo-500)`) et comme classes utilitaires Tailwind (`bg-indigo-500`, `text-indigo-600`, `border-indigo-200`…) via le bloc `@theme` de `inertia/css/app.css`.

### Neutres (fond dominant blanc)

Rampe **« ink »** teintée navy (jamais gris pur), à conserver comme socle du fond blanc dominant — l'indigo reste l'exception, pas la règle :

| Token ink               | Rôle                  |
| ----------------------- | --------------------- |
| `--ink-0`/`--ink-50`    | Fonds de page         |
| `--ink-100`/`--ink-200` | Bordures, séparateurs |
| `--ink-500`/`--ink-600` | Texte secondaire      |
| `--ink-700`/`--ink-800` | Texte principal       |
| `--ink-950`             | Titres, texte fort    |

### Sémantiques

Tokens dédiés désormais disponibles (`inertia/css/tokens/colors.css`) — ne plus coder ces couleurs en dur, utiliser `var(--state-danger)`/`var(--color-danger)` etc. :

| Rôle                | Token                                               | Hex       |
| ------------------- | --------------------------------------------------- | --------- |
| Erreur / destructif | `--state-danger`/`--color-danger` (`--ruby-500`)    | `#E0245E` |
| Succès              | `--state-success`/`--color-success` (`--green-500`) | `#1D8A5C` |
| Avertissement       | `--state-warning`/`--color-warning` (`--amber-500`) | `#B5790A` |

## Règle d'usage de l'indigo

L'indigo est un **accent**, pas une couleur de fond dominante :

- ✅ Boutons d'action (`button`, `.hero .button`), liens/CTA principaux, badges de rappel, anneaux de focus, éléments actifs importants
- ❌ Fonds de page, grandes zones, texte courant, navigation (la navigation reste dans la rampe neutre `--ink-600` / `--ink-950`, l'item actif en `--indigo-50` / `--indigo-600`)

## Typographie

- **Manrope** (600-800) pour les titres, eyebrows et boutons, **Instrument Sans** (400-600) pour le texte — auto-hébergées via `@fontsource` (imports dans `inertia/css/app.css`), landing et application confondues. Plus de Google Fonts ni d'Inter.
- Titres (`h1`–`h6`) en `--text-primary`, Manrope 600, `letter-spacing` négatif sur les tailles display
- Texte courant en `--text-primary`, texte secondaire en `--text-secondary`, discret en `--text-muted`
- Chiffres, prix et quantités en `text-tabular` (chiffres alignés)
- Échelle complète (`text-display-*`, `text-heading-*`, `text-body-*`, `text-caption`, `text-eyebrow`) : voir [`design-system.md`](design-system.md#typographie)

## Composants clés

- **Boutons** : pill (`rounded-pill`), Manrope 600, fond `--indigo-500`, texte blanc, `hover` → `--indigo-600` ; secondaire à bordure `--border-input`, ghost indigo clair (`BaseButton` / `BaseLinkButton`)
- **Focus visible** : anneau `2px solid var(--indigo-500)` global (`app.css`, `@layer base`) sur tout élément interactif (accessibilité clavier)
- **Cartes / conteneurs** : fond blanc, `rounded-xl`, bordure `--border-hairline`, ombre `--shadow-1`, posés sur le fond `--surface-sunken` ; `--shadow-2/3` pour les menus et panneaux détachés
- **Alertes** : succès/erreur restent sémantiques (`--state-danger`/`--state-success`), l'indigo n'est pas utilisé pour les états d'alerte

## Où intervenir pour étendre la charte

- Couleurs : `inertia/css/tokens/colors.css` (rampes `--indigo-*`/`--ink-*` + tokens sémantiques), exposées via `@theme` dans `inertia/css/app.css`
- Typographie/espacements : `inertia/css/tokens/{typography,spacing}.css` ; polices `@fontsource` importées dans `inertia/css/app.css`
- Favicon/meta : `resources/views/inertia_layout.edge` (plus aucune police externe)
- Logo source : `inertia/assets/logo promotional sourcing.*`
