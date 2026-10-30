# Landing : parité avec le site d'origine

> Date : 2026-10-30

Audit des écarts entre le site Astro (`PromotionnalSourcing-landing`) et les pages marketing de l'app,
puis correction de chacun. Détail : `docs/landing.md`.

- **Formulaire de contact** : `POST /:locale/contact` (`marketing.contact.store`) remplace le `mailto:`.
  Champs nom, société, e-mail, téléphone (facultatif), type (`contact` | `partnership`), message ;
  routage vers `contact@` ou `partners@`, envoi par la queue de mails (kind `contact-request`,
  `ContactRequestNotification`), champ piège `botField`, limiteur 5 envois / heure / IP, redirection vers
  `/:locale/thanks`. Le CTA final de l'accueil mène à `/:locale/contact?type=partnership`.
  Composants `contact_form.vue` (remplace `contact_cta.vue`) ; le layout marketing affiche le flash `error`.
- **Textes resynchronisés** dans les 9 langues : lancement « 2027 » (sans mois) et mockup « coton biologique /
  GOTS » (`landing.hero.eyebrow`, `finalCta.badge`, `productMockup.tags`/`ariaLabel`). Les clés `contact.mail*`
  sont remplacées par les clés du formulaire.
- **SEO** : un `hreflang` par langue de l'interface (et plus seulement `fr`/`en`).
- **Typographie et champs** : `text-display-md` à 34 px sur la landing (32 px dans l'app) ; champs du
  formulaire de contact à leur padding d'origine ; compteurs chiffrés formatés selon la locale de la page
  (ils étaient en `fr-FR` partout).
- **Pages légales** (9 langues) : hébergeur remplacé par Clever Cloud SAS (Netlify n'héberge plus le site),
  sous-traitants et données du formulaire alignés, mise à jour au 30 octobre 2026. Adresse complète de
  l'hébergeur à compléter.
- **Images** : visuels de la landing convertis en WebP dimensionnés (`public/img/*.webp`, de 258 Ko à 17 Ko).
- **Tests** : `tests/functional/marketing.spec.ts` (envoi, routage, champ piège, validation, présélection,
  limiteur), `tests/unit/contact_request.spec.ts`, `tests/unit/send_mail_job.spec.ts`,
  `tests/inertia/marketing_contact_form.spec.ts`, `tests/inertia/marketing_head.spec.ts`.
