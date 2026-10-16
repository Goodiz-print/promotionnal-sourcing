# Charte graphique : couleurs de marque et favicon

> Date : 2026-07-03

Mise en place de la charte graphique du site, alignée sur le logo (violet `#4032C8` / RGB `64, 50, 200`, fond dominant blanc, violet réservé à l'accent — boutons et rappels), inspirée de la sobriété de [stripe.com](https://stripe.com/en-fr).

- **`inertia/css/app.css`** :
  - Ajout des variables de marque `--primary-1` à `--primary-11` + `--color-primary-contrast` dans `:root`
  - Ajout d'un bloc `@theme` Tailwind v4 exposant `--color-primary`, `--color-primary-hover`, `--color-primary-1/3/6/9/10/11`, `--color-primary-contrast` (utilisables via `bg-primary`, `text-primary`, etc.)
  - `button` et `.hero .button` passent du gris/noir au violet de marque (fond `--color-primary`, hover `--color-primary-hover`)
  - Ajout d'un anneau de focus visible violet (`--primary-6`) sur boutons, liens, champs de formulaire
- **`public/favicon.svg`, `public/favicon.png`** : copiés depuis `inertia/assets/` pour être servis statiquement (provider `@adonisjs/static`, déjà actif)
- **`resources/views/inertia_layout.edge`** : ajout des balises `<link rel="icon">` (SVG + PNG), `<meta name="theme-color" content="#4032c8">`, et titre par défaut `promotionalsourcing.eu` (au lieu du placeholder `AdonisJS`)
- **`docs/charte-graphique.md`** : documentation complète de la charte (logo, couleurs avec hex/RGB, règles d'usage du violet, typographie, composants, favicon)
- **Comportement notable** : le violet reste un accent — pas de fond de page ni de navigation en violet, uniquement CTA/boutons/focus/rappels ; les couleurs sémantiques (succès/erreur) restent inchangées
