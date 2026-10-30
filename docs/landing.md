# Landing pages

Les pages publiques de présentation (ex-site Astro `promotionnal-sourcing-landing`) vivent
dans l'application : Vue 3 + Inertia, rendues en SSR, dans les 9 langues de l'interface.

## Routes

| Route                   | Nom                       | Page Vue                                     |
| ----------------------- | ------------------------- | -------------------------------------------- |
| `/:locale`              | `home`                    | `marketing/home`                             |
| `/:locale/contact`      | `marketing.contact`       | `marketing/contact`                          |
| `POST /:locale/contact` | `marketing.contact.store` | envoi du formulaire (redirige vers `thanks`) |
| `/:locale/legal`        | `marketing.legal`         | `marketing/legal`                            |
| `/:locale/privacy`      | `marketing.privacy`       | `marketing/privacy`                          |
| `/:locale/thanks`       | `marketing.thanks`        | `marketing/thanks` (noindex)                 |
| `/sitemap.xml`          | `marketing.sitemap`       | XML (pages indexables × langues)             |

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

## Section découverte (#43)

`inertia/components/marketing/discover_section.vue`, sous le hero de l'accueil : recherche (`router.get` vers `products.index?search=`), CTA acheteur / fournisseur vers l'inscription, catégories mises en avant. `MarketingController#home` passe `featuredCategories` (six au plus, `ProductCatalogueService#featuredCategories`). Clés `landing.discover.*`.

## Traductions

`resources/lang/<locale>/landing.json` (clés `landing.*`), `legal.json`, `privacy.json`, dans les 9 langues.
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
- Les images de la landing sont des WebP dimensionnés à 2× l'affichage (`public/img/*.webp`) :
  pas de pipeline d'optimisation côté Vite pour `public/`, on les régénère à la main avec `sharp`.
- `marketing_head.vue` déclare un `hreflang` par langue de l'interface (+ `x-default` = français), comme le sitemap.
- Le titre de section `text-display-md` fait 34 px dans `.marketing` (32 px dans l'app) : surcharge des
  variables dans `marketing.css`.

## Formulaire de contact

`POST /:locale/contact` (`MarketingController#sendContact`, validator `contactRequestValidator`,
service `ContactRequestService`) remplace le `mailto:` pré-rempli.

- Champs : nom, société, e-mail professionnel, téléphone (facultatif), type de demande
  (`contact` | `partnership`), message ; limites dans `CONTACT_FIELD_LIMITS` (`shared/types/marketing.ts`).
- **Routage** : `contact` → `contact@promotional-sourcing.eu`, `partnership` → `partners@promotional-sourcing.eu`
  (`CONTACT_EMAIL` / `PARTNERS_EMAIL`). Le CTA final de l'accueil renvoie vers `/:locale/contact?type=partnership`
  (le formulaire est alors présélectionné ; `?type=partenariat` de l'ancien site reste accepté).
- **Envoi** par la queue de mails (`SendMailJob`, kind `contact-request`, `ContactRequestNotification`) :
  reprise sur erreur, dead-letter, `reply-to` = visiteur. Mail interne, rédigé en français.
- **Anti-spam** : champ piège `botField` (rempli → même redirection qu'un succès, rien n'est envoyé) et
  limiteur `contactRequestThrottle` (5 envois / heure / IP). Un dépassement renvoie sur le formulaire avec un
  toast d'erreur (le layout marketing affiche le flash `error`).
- Succès : redirection vers `/:locale/thanks` (noindex).

## À savoir

- Les mentions légales (`legal.json`) et la politique de confidentialité (`privacy.json`, 9 langues) citent
  **Clever Cloud SAS** comme hébergeur et sous-traitant. L'adresse postale complète de l'hébergeur
  n'y figure pas (ville seulement) : à compléter avec les mentions officielles de Clever Cloud.
- La politique de confidentialité ne couvre que les visiteurs du site vitrine : les comptes et données de
  l'application (utilisateurs, organisations, devis) n'y sont pas décrits.
