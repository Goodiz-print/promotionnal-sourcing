# Landing pages

Les pages publiques de présentation (ex-site Astro `promotionnal-sourcing-landing`) vivent
dans l'application : Vue 3 + Inertia, rendues en SSR, FR/EN.

## Routes

| Route              | Nom                 | Page Vue                         |
| ------------------ | ------------------- | -------------------------------- |
| `/:locale`         | `home`              | `marketing/home`                 |
| `/:locale/contact` | `marketing.contact` | `marketing/contact`              |
| `/:locale/legal`   | `marketing.legal`   | `marketing/legal`                |
| `/:locale/privacy` | `marketing.privacy` | `marketing/privacy`              |
| `/:locale/thanks`  | `marketing.thanks`  | `marketing/thanks` (noindex)     |
| `/sitemap.xml`     | `marketing.sitemap` | XML (pages indexables × langues) |

Contrôleur : `app/controllers/marketing_controller.ts` (fin, aucune logique métier ; passe
`siteUrl`, dérivé de `APP_URL`, pour les URLs absolues canonical/hreflang/Open Graph).
Routes : `start/routes/marketing.ts` ; les anciennes URLs du site Astro y sont redirigées en 301.
Le bouton « Connexion » pointe vers `session.create`.

## Structure frontend

- `inertia/layouts/marketing.vue` : header, footer, effets de défilement. Appliqué par
  `defineOptions({ layout: MarketingLayout })` dans chaque page ; le layout `default.vue`
  reste celui de l'app.
- `inertia/components/marketing/` : sections (hero, features, stats, fournisseurs, CTA),
  `marketing_head.vue` (title, description, canonical, hreflang, Open Graph, JSON-LD),
  `legal_document.vue` (sommaire + sections des documents légaux).
- Génériques : `base_link_button.vue` (lien en bouton), `base_card.vue`.
- Composables : `use_marketing` (chemins préfixés par la locale), `use_scroll_fx`
  (reveal/compteurs/header), `use_canvas_fx` + `canvas_fx/` (animations canvas, pilotées par
  `fx_canvas.vue`, arrêtées hors écran et si `prefers-reduced-motion`).

## Traductions

`resources/lang/{fr,en}/landing.json` (clés `landing.*`), `legal.json`, `privacy.json`.
Le dictionnaire étant plat (chaînes), les listes sont indexées (`mailPoints.0`). Le corps des
sections légales est du HTML statique rendu via `v-html` (contenu de nos fichiers de langue
uniquement).

## Styles et assets

- `inertia/css/marketing.css` (importé par `app.css`) : utilitaires (`text-display-*`,
  `wrapper`, `legal-prose`…), animations, base scopée sous `.marketing`. Le reset global de
  `app.css` exclut `.marketing` (voir le commentaire dans le fichier).
- Images et icônes dans `public/` (`/logo.png`, `/img/*`, `og-*.png`…). Dans un template, les
  lier par une chaîne dynamique (`:src="CONST"`) : Vite tenterait sinon de résoudre `/logo.png`
  comme un import.
- Le contact reste un `mailto:` pré-rempli (pas de formulaire serveur).

## À savoir

- Les mentions légales citent encore Netlify comme hébergeur : à mettre à jour dans
  `resources/lang/*/legal.json` (et `privacy.json`) quand le site sera servi par l'app.
