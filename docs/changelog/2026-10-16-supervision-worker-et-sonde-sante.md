# Supervision du worker et sonde de santé (#61)

Date : 2026-10-16

- **`GET /health`** (hors préfixe de locale, sans authentification) : 200 `{ "status": "ok" }` si la base répond, 503 `{ "status": "down" }` sinon. Ne regarde pas la queue.
- **`node ace queue:health`** : rapport JSON sur la queue (`pendingOverdue`, `oldestPendingAgeMs`, `stuckActive`, `failedLast24h`). Sortie 1 si un job `pending` ou `delayed` dépasse son échéance de 15 min, ou si un job `active` est acquis depuis plus de 30 min.
- **Compose** : healthcheck du web sur `/health`, healthcheck du worker sur `queue:health` (toutes les 60 s).
- Seuils dans `shared/types/health.ts`. Procédure dans `docs/queue.md`.
- Non couvert : alerte externe (PagerDuty, Sentry, cron), #79 pour Sentry.
