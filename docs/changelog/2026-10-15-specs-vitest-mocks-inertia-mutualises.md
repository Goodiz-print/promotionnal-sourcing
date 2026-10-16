# Specs Vitest : mocks Inertia mutualisés (phase 4)

> Date : 2026-10-15

- **`tests/inertia/support/inertia_mocks.ts`** : `inertiaPage`, `makeUseForm`,
  `HeadStub`, `LinkStub`. 13 specs (`rfqs`, `supplier_rfqs`, `suppliers`,
  `products`, `account`, `password_reset`…) n'y recopient plus le mock de
  `@inertiajs/vue3` / `<Link>` ; `router`, `urlFor` et les mocks de composables
  restent propres à chaque spec. Les specs aux mocks spécifiques (`passkeys`,
  `organization_switcher`, `organization_danger_zone`, `verify_email`, `i18n`)
  sont inchangés.
- **`vitest.config.ts`** : `unstubGlobals: true`.
- Aucun gain de vitesse attendu (Vitest tournait déjà en parallèle, ~10 s) :
  c'est de la maintenabilité. 90 tests avant et après.
