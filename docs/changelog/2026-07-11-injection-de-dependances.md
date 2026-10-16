# Injection de dépendances (conteneur IoC AdonisJS)

> Date : 2026-07-11

Adopte l'**injection de dépendances** partout : plus de `new Service()` dans les
controllers/services/jobs/commands (retour de revue). Règle ajoutée à `CLAUDE.md`.

- **Controllers** décorés `@inject()` avec dépendances par **constructeur** (le
  routeur les résout via le conteneur) : `products`, `suppliers`, `onboarding`,
  `admin/category`, `supplier/{profile,product}`.
- **Services** : `EmbeddingService` et `SupplierProductService` en `@inject()`
  (dépendances injectées, plus de `new` par défaut).
- **Abstraction IA** : `EmbeddingProvider` devient une **classe abstraite**
  (token IoC) ; le service provider `providers/ai_provider.ts` lie le driver
  choisi par `AI_PROVIDER` (`container.singleton`) via `provider_registry.ts`
  (`embeddingProviderFor`). `EmbeddingService` injecte l'abstraction.
- **Jobs / commands** résolvent via `app.container.make(...)` (plus de `new`).
- Règle DI documentée dans `CLAUDE.md` (+ « Ne jamais faire »).
