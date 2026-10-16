# Langues européennes et drapeaux

> Date : 2026-10-16

L'interface passe de 2 à 9 langues : `de`, `es`, `it`, `nl`, `pt`, `pl`, `sv` s'ajoutent à
`fr` et `en` (URL `/de`, `/de/contact`…, sitemap et hreflang inclus). Détail : `docs/i18n.md`.

- **Traductions** : `resources/lang/<code>/` pour tous les domaines (landing comprise),
  générées automatiquement — à relire par un natif avant mise en avant. Textes juridiques
  (`legal`, `privacy`) : repli sur l'anglais.
- **Contenu du catalogue** : reste en `fr`/`en` (`CONTENT_LOCALES`) ; les nouvelles langues
  lisent les fiches en anglais, la recherche porte sur la langue de contenu servie.
- **Sélecteur** : menu avec drapeaux SVG (`language_menu.vue`, `flag_icon.vue`) dans l'app,
  le header de la landing (liens), le profil et les formulaires de traduction.
- **Migration** `1792100000000_extend_users_locale_check` : contrainte `users.locale` étendue.
- **Tests** : `tests/functional/locales.spec.ts`, `tests/inertia/language_menu.spec.ts`.
- Non traduits : les e-mails (`resources/views/emails`, en français).
