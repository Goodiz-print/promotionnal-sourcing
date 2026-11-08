# Santé de la plateforme et alertes (administration)

> Date : 2026-11-08

Issue #179 : `GET /health` ne vérifie que la base (voulu : un backlog de queue ne doit pas redémarrer le conteneur web). Rien ne surveillait la queue, Meilisearch, Cellar, les mails, VIES ni Mistral, et personne n'était prévenu d'une dégradation.

## Principe

**La sonde de liveness `/health` est inchangée** : elle ne dépend que de la base, et son contrôleur n'injecte aucun autre composant. Une panne de Meilisearch, de Cellar ou de Mistral ne la fait donc pas tomber (testé : moteur injoignable, `/health` répond 200).

Le rapport détaillé vit ailleurs, sous deux formes : un point d'entrée protégé pour la supervision externe, et un écran du back-office.

## Composants sondés

Chaque sonde est isolée et plafonnée (`HEALTH_PROBE_TIMEOUT_MS`, 3 s) : une exception ou un service muet donne `down` pour ce composant, jamais une erreur pour le rapport.

| Composant  | Sonde                                                           | `down`                                | `degraded`                                     | Non configuré           |
| ---------- | --------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------- | ----------------------- |
| `database` | `select 1`                                                      | injoignable                           | plus lent que `HEALTH_SLOW_MS`                 | —                       |
| `queue`    | `HealthService.queueReport` (mêmes seuils que `queue:health`)   | jobs en retard (personne ne consomme) | jobs `active` figés                            | —                       |
| `search`   | santé de Meilisearch                                            | injoignable ou erreur                 | lent                                           | sans `MEILISEARCH_HOST` |
| `storage`  | `HEAD` d'une clé réservée sur Cellar (rien n'est écrit)         | réseau, authentification              | lent                                           | —                       |
| `mail`     | échecs d'envoi (`mail_deliveries.failed`) sur la dernière heure | —                                     | au moins `HEALTH_MAIL_FAILED_THRESHOLD` échecs | —                       |
| `vies`     | `GET …/vies/rest-api/check-status`                              | —                                     | HTTP en erreur, injoignable                    | —                       |
| `mistral`  | `GET https://api.mistral.ai/v1/models` (aucun token consommé)   | clé refusée (401/403)                 | autre erreur, lent                             | sans `MISTRAL_API_KEY`  |

Le mail est jugé sur le journal plutôt que sur une connexion SMTP : un serveur qui répond mais refuse les mails ne se voit pas à la connexion. VIES, hors de notre contrôle, ne dépasse jamais `degraded` et n'alerte jamais. Un composant non configuré est `disabled` : ignoré du statut global, jamais alertant. Statut global = le pire des composants sondés.

## Point d'entrée de supervision externe

`GET /health/details` (`health.details`, `HealthDetailsController`), `Authorization: Bearer <HEALTH_TOKEN>`.

- **Sans `HEALTH_TOKEN` configuré : 404** (jamais ouvert par défaut). Mauvais jeton : 401 (comparaison en temps constant).
- 200 avec le rapport `{ status, components[], checkedAt }` ; **503 seulement si le statut global est `down`** (un `degraded` se lit dans le corps).
- Les sondes tournent à chaque appel : une supervision externe doit interroger toutes les minutes au plus.

## Écran du back-office

`GET /:locale/admin/health` (`admin.health.index`, `HealthController`, droit `ops.manage`, onglet « Santé »). Sonde en direct et y joint l'état conservé : depuis quand le composant a ce statut, alerte envoyée ou non.

## Surveillance et alertes

Job `CheckPlatformHealthJob`, planning `check-platform-health` (`*/5 * * * *`, relançable depuis l'écran de la queue). Chaque passe sonde les composants et conserve leur état dans `health_component_states` (une ligne par composant).

- Alerte quand un composant reste hors `ok` **`HEALTH_ALERT_AFTER_FAILURES` passes de suite** (2 par défaut, soit une dizaine de minutes) : un raté isolé ne réveille personne.
- **Une alerte par incident**, pas une par passe, puis une alerte au rétablissement. Un incident qui s'aggrave (`degraded` → `down`) est notifié à nouveau.
- Canal : log `error` structuré (`platform health changed`, que Sentry reprendra dès qu'il est branché, #79) et mail à `MAIL_ALERT_ADDRESS` — le même destinataire que les mails en échec ; vide = log seul. Le mail part en direct, pas par la queue : une queue à l'arrêt est justement ce qu'il faut signaler. Une erreur d'envoi est loguée, jamais propagée, et l'alerte reste due : `alerted` n'est acté qu'une fois le mail parti, elle est donc rejouée à la passe suivante.
- Le tableau de bord (droit `ops.manage`) affiche les **derniers états conservés** sans sonder (`platform`) ; il invite à attendre tant que le job n'a jamais tourné, et avertit que les états sont **périmés** quand la dernière passe a plus de 15 minutes (worker arrêté).
- Deux passes ne s'exécutent jamais en même temps (advisory lock Postgres) : la seconde s'efface, ce qui évite une alerte en double.
- Mistral injoignable (réseau, délai) est `degraded` ; seul un refus de la clé (401/403) est `down`.
- `GET /health/details` est limité à 60 appels par minute et par IP (chaque appel sonde VIES et Mistral).

## Configuration

Toutes les variables sont optionnelles (`.env.example`) :

| Variable                       | Défaut | Rôle                                                           |
| ------------------------------ | ------ | -------------------------------------------------------------- |
| `HEALTH_TOKEN`                 | —      | Jeton de `/health/details` (absent = point d'entrée désactivé) |
| `HEALTH_PROBE_TIMEOUT_MS`      | 3000   | Délai maximal d'une sonde                                      |
| `HEALTH_SLOW_MS`               | 1500   | Au-delà, le composant est `degraded`                           |
| `HEALTH_MAIL_FAILED_THRESHOLD` | 5      | Échecs d'envoi par heure avant `degraded`                      |
| `HEALTH_ALERT_AFTER_FAILURES`  | 2      | Passes consécutives avant l'alerte                             |

## Points d'attention

- Migration à appliquer : `node ace migration:run` (`1794000000009`, table `health_component_states`).
- Si le worker est à l'arrêt, le job ne tourne pas et aucune alerte ne part : c'est le rôle de `GET /health/details` interrogé de l'extérieur (la queue y apparaît `down`) et de `node ace queue:health`.
- `StorageService.ping()` est ajouté pour la sonde Cellar : un `HEAD` sur une clé réservée, qui suppose une clé d'accès pouvant lire le bucket (un 403 est traité comme une panne).
- Les 7 langues autres que le français et l'anglais reçoivent le texte anglais pour les clés admin.
- Tests : `tests/functional/admin_health.spec.ts` (à exécuter en CI : pas de PostgreSQL en local), `tests/inertia/admin_health.spec.ts`.
