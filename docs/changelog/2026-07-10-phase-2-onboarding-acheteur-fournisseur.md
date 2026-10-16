# Phase 2 (PR 3/4) : onboarding acheteur/fournisseur

> Date : 2026-07-10

Le signup ne crée qu'un `User` (sans organisation) : l'onboarding crée la
**première organisation** de l'utilisateur et fixe son type. Signal « à
onboarder » = `currentOrganizationId == null` (aucun flag/migration DB).

- **Flux** : signup / login sans organisation courante → redirection vers
  `onboarding.show`. L'écran demande le **nom d'organisation** + le **type**
  (acheteur/fournisseur) ; le `POST` crée l'`Organization` (slug dérivé du nom),
  rattache l'utilisateur en **`owner`**, fixe `currentOrganizationId`, redirige à l'accueil.
- **Routes** (`:locale` + `auth`) : `GET/POST /onboarding` (`onboarding.show` / `onboarding.store`).
- **Middleware** `onboarded` (`app/middleware/onboarded_middleware.ts`, nommé dans
  `start/kernel.ts`) : redirige les utilisateurs org-less accédant à un écran nécessitant une
  organisation (ex. `supplier/profile`) vers l'onboarding. `new_account`/`session` controllers
  redirigent vers l'onboarding après auth si pas d'org.
- **Backend** : service `onboarding_service.ts` (`completeOnboarding`, slug unique via
  `stringHelpers.slug`), validator `onboarding.ts` (`ONBOARDING_TYPES` = buyer/supplier),
  type partagé `OnboardingData`/`OnboardingKind`.
- **Frontend** : `inertia/pages/onboarding/index.vue` (`useForm`) + nouveau composant réutilisable
  `inertia/components/base_radio_group.vue` (cartes radio génériques) + i18n
  `resources/lang/{fr,en}/onboarding.json`.
- **Tests** : `tests/functional/onboarding.spec.ts` (5 cas : redirection signup, rendu, création
  org+owner+org courante, déjà-onboardé, gate middleware — SQLite/`RoleSeeder`) ;
  `tests/inertia/onboarding.spec.ts` + `base_radio_group` ; `auth.spec.ts` adapté (redirection
  signup/login → onboarding). Résultat : functional sqlite → 26 passés, 17 sautés ; Vitest → 20.
- **Doc** : `docs/organisations.md` (section « Onboarding »).
