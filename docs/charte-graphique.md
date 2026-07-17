# Charte graphique — promotionalsourcing.eu

Référence visuelle : sobriété façon [stripe.com](https://stripe.com/en-fr) — fond dominant blanc, neutres teintés navy pour le texte/les bordures, indigo en accent réservé aux actions (boutons, liens forts, focus, rappels).

> Tokens détaillés (typo, espacements, patterns de composants) : voir [`design-system.md`](design-system.md). Ce document reste la référence pour le logo, le favicon et les règles de marque ; en cas de divergence sur les valeurs exactes, `inertia/css/tokens/colors.css` fait foi (source réellement chargée par l'app).

## Logo

- Fichiers sources : `inertia/assets/logo promotional sourcing.png` / `.ai`
- Wordmark noir (`promotional sourcing`) + pastille `.eu` en violet plein avec point blanc
- Toujours sur fond blanc ou très clair (`--gray-1` / `--gray-2`) — ne jamais poser le logo sur un fond violet ou foncé sans version inversée dédiée
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

Rampe `--indigo-*` définie dans `inertia/css/tokens/colors.css` (import de `app.css`) ; les alias historiques `--primary-*`/`--color-primary*` sont conservés et repointés dessus pour la rétro-compatibilité des composants existants.

| Token CSS      | Alias historique                         | Usage                                                 | Hex       | RGB             |
| -------------- | ---------------------------------------- | ----------------------------------------------------- | --------- | --------------- |
| `--indigo-500` | `--primary-9` / `--color-primary`        | Couleur de marque, boutons, liens forts               | `#4032C8` | `64, 50, 200`   |
| `--indigo-600` | `--primary-10` / `--color-primary-hover` | Hover/active des éléments indigo                      | `#3527AD` | `53, 39, 173`   |
| `--indigo-700` | `--primary-11`                           | Texte indigo sur fond clair (contraste renforcé)      | `#2A1E8C` | `42, 30, 140`   |
| `--indigo-400` | `--primary-6`                            | Anneaux de focus, états discrets                      | `#6858E0` | `104, 88, 224`  |
| `--indigo-100` | `--primary-3`                            | Fond de badge/callout indigo clair                    | `#D6D1F7` | `214, 209, 247` |
| `--indigo-50`  | `--primary-1`                            | Fond très subtil (survol de ligne, section highlight) | `#EEECFC` | `238, 236, 252` |
| `--ink-0`      | `--color-primary-contrast`               | Texte sur fond indigo                                 | `#FFFFFF` | `255, 255, 255` |

Disponibles à la fois comme variables CSS (`var(--indigo-500)`, ou l'alias `var(--primary-9)`/`var(--color-primary)`) et comme classes utilitaires Tailwind (`bg-indigo-500`, `text-primary`, `border-primary-6`, etc.) via le bloc `@theme` de `inertia/css/app.css`.

### Neutres (fond dominant blanc)

Rampe **« ink »** teintée navy (jamais gris pur), à conserver comme socle du fond blanc dominant — l'indigo reste l'exception, pas la règle. Les alias `--gray-*` historiques sont conservés (composants existants) :

| Token ink               | Alias historique         | Rôle                  |
| ----------------------- | ------------------------ | --------------------- |
| `--ink-0`/`--ink-50`    | `--gray-1` / `--gray-2`  | Fonds de page         |
| `--ink-100`/`--ink-200` | `--gray-3` / `--gray-4`  | Bordures, séparateurs |
| `--ink-500`/`--ink-600` | `--gray-6` / `--gray-7`  | Texte secondaire      |
| `--ink-700`/`--ink-800` | `--gray-8` / `--gray-10` | Texte principal       |
| `--ink-950`             | `--gray-12`              | Titres, texte fort    |

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
- ❌ Fonds de page, grandes zones, texte courant, navigation (la nav reste dans la rampe neutre `--gray-8` / `--gray-12` au survol/actif)

## Typographie

- **Inter** (400-700) pour le texte, **IBM Plex Mono** pour les chiffres/prix/réf. — chargées via Google Fonts dans `resources/views/inertia_layout.edge` (substituts de Sohne, propriétaire). Plus de `system-ui` par défaut.
- Titres (`h1`–`h6`) en `--gray-12`/`--text-primary`, poids 600, `letter-spacing` légèrement négatif sur les gros titres (cf. `.hero h1`, `.form-container h1`)
- Texte courant en `--gray-10`, texte secondaire en `--gray-6` / `--gray-7`
- Échelle complète (`type-display-xl`, `type-heading-md`, `type-body-sm`…) : voir [`design-system.md`](design-system.md#typographie)

## Composants clés

- **Boutons** : fond `--color-primary`, texte blanc, `hover` → `--color-primary-hover`, `border-radius: 4–6px`
- **Focus visible** : anneau `2px solid var(--primary-6)` sur boutons, liens, champs de formulaire (accessibilité clavier)
- **Cartes / conteneurs** : fond blanc, bordure `--gray-3`, pas d'ombre lourde par défaut (ombres subtiles `--shadow-1/2/3` réservées aux éléments détachés du flux — cohérent avec la sobriété Stripe)
- **Alertes** : succès/erreur restent sémantiques (`--color-danger`/`--color-success`), l'indigo n'est pas utilisé pour les états d'alerte

## Où intervenir pour étendre la charte

- Couleurs : `inertia/css/tokens/colors.css` (rampes `--indigo-*`/`--ink-*` + tokens sémantiques + alias `--primary-*`/`--gray-*`), exposées via `@theme` dans `inertia/css/app.css`
- Typographie/espacements : `inertia/css/tokens/{typography,spacing}.css`
- Favicon/meta : `resources/views/inertia_layout.edge`
- Logo source : `inertia/assets/logo promotional sourcing.*`
