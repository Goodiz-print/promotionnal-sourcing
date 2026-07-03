# Charte graphique — promotionalsourcing.eu

Référence visuelle : sobriété façon [stripe.com](https://stripe.com/en-fr) — fond dominant blanc, gris neutres pour le texte/les bordures, violet en accent réservé aux actions (boutons, liens forts, focus, rappels).

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

### Violet de marque (issu du logo)

| Token CSS                                | Usage                                                 | Hex       | RGB             |
| ---------------------------------------- | ----------------------------------------------------- | --------- | --------------- |
| `--primary-9` / `--color-primary`        | Couleur de marque, boutons, liens forts               | `#4032C8` | `64, 50, 200`   |
| `--primary-10` / `--color-primary-hover` | Hover/active des éléments violets                     | `#362BAB` | `54, 43, 171`   |
| `--primary-11`                           | Texte violet sur fond clair (contraste renforcé)      | `#2C2389` | `44, 35, 137`   |
| `--primary-6`                            | Anneaux de focus, états discrets                      | `#8078E0` | `128, 120, 224` |
| `--primary-3`                            | Fond de badge/callout violet clair                    | `#E4E1F9` | `228, 225, 249` |
| `--primary-1`                            | Fond très subtil (survol de ligne, section highlight) | `#F2F1FC` | `242, 241, 252` |
| `--color-primary-contrast`               | Texte sur fond violet                                 | `#FFFFFF` | `255, 255, 255` |

Définis dans `inertia/css/app.css` (`:root` + bloc `@theme`), donc disponibles à la fois comme variables CSS (`var(--primary-9)`) et comme classes utilitaires Tailwind (`bg-primary`, `text-primary`, `border-primary-6`, etc.).

### Neutres (fond dominant blanc)

Échelle de gris déjà en place, à conserver comme socle du fond blanc dominant — le violet reste l'exception, pas la règle :

| Token                    | Rôle                  |
| ------------------------ | --------------------- |
| `--gray-1` / `--gray-2`  | Fonds de page         |
| `--gray-3` / `--gray-4`  | Bordures, séparateurs |
| `--gray-6` / `--gray-7`  | Texte secondaire      |
| `--gray-8` / `--gray-10` | Texte principal       |
| `--gray-12`              | Titres, texte fort    |

### Sémantiques (inchangées)

- Erreur / destructif : `#fb2c36`
- Succès : `#00a63e`

## Règle d'usage du violet

Le violet est un **accent**, pas une couleur de fond dominante :

- ✅ Boutons d'action (`button`, `.hero .button`), liens/CTA principaux, badges de rappel, anneaux de focus, éléments actifs importants
- ❌ Fonds de page, grandes zones, texte courant, navigation (la nav reste en gris `--gray-8` / `--gray-12` au survol/actif)

## Typographie

- `system-ui, sans-serif` (pas de webfont custom pour l'instant)
- Titres (`h1`–`h6`) en `--gray-12`, poids 600, `letter-spacing` légèrement négatif sur les gros titres (cf. `.hero h1`, `.form-container h1`)
- Texte courant en `--gray-10`, texte secondaire en `--gray-6` / `--gray-7`

## Composants clés

- **Boutons** : fond `--color-primary`, texte blanc, `hover` → `--color-primary-hover`, `border-radius: 4–6px`
- **Focus visible** : anneau `2px solid var(--primary-6)` sur boutons, liens, champs de formulaire (accessibilité clavier)
- **Cartes / conteneurs** : fond blanc, bordure `--gray-3`, pas d'ombre lourde (cohérent avec la sobriété Stripe)
- **Alertes** : succès/erreur restent sémantiques (rouge/vert), le violet n'est pas utilisé pour les états d'alerte

## Où intervenir pour étendre la charte

- Couleurs : `inertia/css/app.css` (variables `--primary-*` + bloc `@theme`)
- Favicon/meta : `resources/views/inertia_layout.edge`
- Logo source : `inertia/assets/logo promotional sourcing.*`
