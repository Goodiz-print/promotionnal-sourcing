# Rate limiting sur l'authentification (#46)

> Date : 2026-10-15

`POST /login`, `POST /signup`, la demande de mot de passe oublié et le renvoi du
mail de vérification ne sont plus appelables sans limite (force brute, création
de comptes en masse, spam de boîtes mail).

- **`@adonisjs/limiter`** — `config/limiter.ts`, table `rate_limits` (migration
  avec `down()`), provider enregistré. Variable d'environnement
  **`LIMITER_STORE`** (`database` | `memory`), **obligatoire** : `database` en
  production (compteurs partagés entre instances), `memory` pour les tests
  (`.env.test`, CI). Documentée dans `.env.example`.
- **Limiteurs nommés** (`start/limiter.ts`), appliqués route par route :
  | Limiteur                    | Clé                                | Limite     |
  | --------------------------- | ---------------------------------- | ---------- |
  | `login`                     | IP + email (insensible à la casse) | 5 / 15 min |
  | `signup`                    | IP                                 | 10 / heure |
  | `password-reset`            | email                              | 5 / heure  |
  | `email-verification-resend` | compte (IP à défaut)               | 5 / heure  |
- **Seuls les échecs de login comptent** — une connexion réussie remet le
  compteur à zéro (`clearLoginThrottle`). La 6ᵉ tentative est bloquée, même avec
  le bon mot de passe.
- **Réponse Inertia, pas JSON** — `HttpExceptionHandler` convertit
  `E_TOO_MANY_REQUESTS` en `redirect().back()` + message flash `auth.throttled`
  (« Trop de tentatives. Réessayez dans N min. »), avec l'en-tête `Retry-After`.
  Un client API (`Accept: application/json` sans `X-Inertia`) reçoit un 429.
- **Tests** — `tests/functional/rate_limiting.spec.ts` (8). `useDatabase` vide les
  compteurs avant chaque test : toutes les requêtes de test partagent la même IP
  et s'accumuleraient sinon d'une spec à l'autre. Non couvert : l'expiration de
  la fenêtre (pas d'horloge injectable dans le projet) ; la remise à zéro est
  vérifiée par le succès de login.
- **Déploiement** — définir `LIMITER_STORE=database` et jouer la migration
  `create_rate_limits_table` avant de démarrer ; l'application refuse de booter
  sans cette variable.
