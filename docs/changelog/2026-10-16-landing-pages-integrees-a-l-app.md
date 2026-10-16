# Landing pages intégrées à l'app (portage du site Astro)

> Date : 2026-10-16

Le site `promotionnal-sourcing-landing` (Astro) est porté dans l'app en Vue/Inertia
(SSR) ; le bouton « Connexion » du header mène désormais à `/:locale/login`
(« Accéder à l'app » si l'utilisateur est déjà connecté). Détail : `docs/landing.md`.

- **Routes publiques** (sous `/:locale`) : `home` (`/fr`, `/en`), `marketing.contact`,
  `marketing.legal`, `marketing.privacy`, `marketing.thanks` (noindex). Slugs identiques
  en FR et EN. Contrôleur `MarketingController`, routes dans `start/routes/marketing.ts`.
- **Redirections 301** des anciennes URLs du site Astro (`/mentions-legales`,
  `/politique-de-confidentialite`, `/merci`, `/contact`, `/en/legal-notice`,
  `/en/privacy-policy`, `/en/thank-you`) vers les nouvelles ; `GET /sitemap.xml`
  généré (pages indexables × langues, hreflang) ; `public/robots.txt` mis à jour.
- **Frontend** : layout `inertia/layouts/marketing.vue`, composants
  `inertia/components/marketing/`, pages `inertia/pages/marketing/`, composables
  `use_marketing`, `use_scroll_fx`, `use_canvas_fx` ; génériques `base_link_button` et
  `base_card`. Polices Manrope + Instrument Sans (`@fontsource`), `inertia/css/marketing.css`.
- **i18n** : `landing.json`, `legal.json`, `privacy.json` (FR/EN) ; `home.json` du starter supprimé.
- **CSS** : le reset `* { margin:0; padding:0 }` de `app.css` exclut le sous-arbre `.marketing`
  (non layeré, il écrasait les utilitaires Tailwind).
- **Tests** : `tests/functional/marketing.spec.ts`, `tests/inertia/marketing_header.spec.ts`.
