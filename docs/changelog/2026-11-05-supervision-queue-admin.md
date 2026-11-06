# Supervision de la queue et des jobs planifiés (administration)

> Date : 2026-11-05

Issue #175 : l'équipe admin voit la santé de la queue, les jobs en attente, actifs, échoués ou bloqués, relance ou annule un job échoué et lance un job planifié, sans passer par `node ace queue:health`.

## Droit et navigation

Nouveau droit `queue.manage`, porté par le seul rôle `admin` : la charge utile d'un job peut contenir des données personnelles et les actions modifient la queue. 403 pour les autres rôles plateforme ; onglet « File d'attente » masqué.

## Écrans et routes

- `GET /:locale/admin/queue` (`admin.queue.index`, `QueueController`) : rapport de santé, effectifs par état, jobs planifiés et liste paginée des jobs (25 par page, les plus récents d'abord). Filtres : état (`pending`, `delayed`, `active`, `completed`, `failed`, ou `stuck` pour les jobs actifs bloqués) et nom du job (recherche partielle, jokers `%` et `_` cherchés tels quels).
- `GET /:locale/admin/queue/jobs/:queue/:id` (`admin.queue.show`) : état, essais, worker, échéance, dates, erreur complète et charge utile, tronquées à 4 000 caractères.
- `POST /:locale/admin/queue/jobs/:queue/:id/retry` (`admin.queue.retry`) : remet un job **échoué** en attente, compteur d'essais remis à zéro. Sans effet (message d'erreur) si le job n'est plus `failed`. Audit `queue_job.retried`.
- `POST /:locale/admin/queue/jobs/:queue/:id/cancel` (`admin.queue.cancel`) : supprime un job `pending`, `delayed` ou `failed`. **Un job actif n'est jamais annulable** : un worker le tient. Audit `queue_job.cancelled`.
- `POST /:locale/admin/queue/schedules/:id/run` (`admin.queue.schedules.run`) : lance un job planifié hors de son horaire. Audit `queue_schedule.run`.
- Tableau de bord (`GET /admin`) : prop `queue` (rapport de santé) pour le droit `queue.manage`, `null` sinon ; l'écran affiche le rapport avec un lien vers la supervision.

## Santé

`AdminQueueService` réutilise `HealthService.queueReport` et les seuils de `shared/types/health.ts` (`QUEUE_THRESHOLDS`) : mêmes chiffres que `node ace queue:health`. Un job est **en retard** (`overdue`) quand son échéance est dépassée de plus de 15 minutes ; un job `pending`, qui n'a pas d'échéance, est daté de sa mise en file (dérivée du score) — `HealthService.queueReport` applique la même règle (`coalesce(execute_at, score % 1e13)`), donc la sonde `queue:health`, le tableau de bord et la liste s'accordent sur les jobs en retard. Il est **bloqué** (`stuck`) quand il est actif depuis plus de 30 minutes.

## Jobs planifiés

La liste vient de `queue_schedules` (alimentée par `start/scheduler.ts`) : planification, fuseau, nombre de passages, dernier et prochain passage. Le lancement manuel est limité aux sept tâches de maintenance idempotentes et sans charge utile (`MANUAL_RUNS` dans `AdminQueueService`) ; il ne modifie ni le prochain passage ni le compteur. Tout nouveau job planifié s'affiche, mais ne se lance à la main qu'une fois ajouté à cette liste.

## À savoir

- L'audit ne porte pas d'identifiant de cible : les identifiants de job sont des UUID alors que `admin_audit_logs.target_id` est numérique. Le job (identifiant, file, classe) est dans `changes.after`.
- La charge utile est affichée telle que stockée ; elle peut contenir des données personnelles (destinataire d'un mail, etc.).
