# i18n : sélection de la langue par préfixe d'URL (/fr, /en)

> Date : 2026-07-08

Ajout d'un routing localisé par **préfixe d'URL** au-dessus du socle i18n existant (PR #10), pour un meilleur SEO (URLs distinctes indexables par langue, cohérent avec le SSR). Le moteur i18n de #10 (formatage ICU via `intl-messageformat`, types partagés, `translations`/`supportedLocales` en props, messages de validation traduits, persistance cookie + `users.locale`) est **conservé** ; seule la couche de sélection de langue évolue.

- **Routing** (`start/routes.ts`) : les routes applicatives passent sous un groupe `.prefix(':locale').where('locale', /^(fr|en)$/)` ; la racine `/` **redirige** vers la locale résolue ; une locale non supportée (`/de/…`) renvoie 404. `POST /locale` reste hors préfixe.
- **Priorité de détection** (`app/middleware/detect_user_locale_middleware.ts`) : **préfixe d'URL** > cookie > `users.locale` > `Accept-Language` > défaut. La locale issue de l'URL est mémorisée dans le cookie signé (la racine se souvient de la dernière langue visitée).
- **Changement de langue** (`app/controllers/locale_controller.ts`) : `POST /locale` persiste le choix (cookie + utilisateur) puis **redirige vers l'URL préfixée** de la nouvelle langue (segment de locale reconstruit depuis le `referer`).
- **Liens/formulaires localisés** : `:params="{ locale }"` sur les `<Link>`/`<Form>` nommés (layout, login, signup) ; redirections contrôleurs `toRoute(..., { locale })`.
- **Tests** (`tests/functional/i18n.spec.ts`) : redirection racine, `Accept-Language`, rendu `/fr` & `/en`, 404 locale invalide, `POST /locale` → URL préfixée + cookie, rejet locale non supportée.
- **Note** : deux migrations partagent le préfixe `…948` (`alter_users_add_locale` de #10 et `enable_search_extensions` du catalogue) — sans impact (noms uniques, tri déterministe), à renuméroter lors d'un prochain reset de migrations si souhaité.
