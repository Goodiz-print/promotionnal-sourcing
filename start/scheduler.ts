/*
|--------------------------------------------------------------------------
| Scheduler
|--------------------------------------------------------------------------
|
| This file is used to define scheduled jobs. You can schedule jobs to run
| at specific intervals using cron expressions or duration strings.
|
| Example:
|
|   import SendWeeklyReport from '#jobs/send_weekly_report'
|
|   SendWeeklyReport.schedule({ userId: 1 })
|     .cron('0 9 * * MON')
|     .run()
|
*/

import PurgeExpiredInvitationsJob from '#jobs/purge_expired_invitations_job'

/**
 * Purge quotidienne des invitations d'organisation (bascule `pending` échues en
 * `expired`, puis suppression après rétention) — cf.
 * `OrganizationInvitationsService#purgeExpired`. Planifiée de nuit, heure de
 * Paris : aucune contrainte de fraîcheur (l'échéance est déjà vérifiée à
 * l'acceptation), seul le ménage en base est visé.
 */
await PurgeExpiredInvitationsJob.schedule({})
  .id('purge-expired-invitations')
  .cron('15 3 * * *')
  .timezone('Europe/Paris')
  .run()

import RecoverStorageUploadsJob from '#jobs/recover_storage_uploads_job'

/**
 * Reprise horaire du stockage : envois interrompus (`pending_upload` > 24 h) et
 * purges perdues (`pending_delete` > 24 h). Le seuil de 24 h, pas la fréquence,
 * protège les envois en cours.
 */
await RecoverStorageUploadsJob.schedule({})
  .id('recover-storage-uploads')
  .cron('30 * * * *')
  .timezone('Europe/Paris')
  .run()
