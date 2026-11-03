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
import RecoverStorageUploadsJob from '#jobs/recover_storage_uploads_job'
import ExpireRfqsJob from '#jobs/expire_rfqs_job'
import RemindRfqSuppliersJob from '#jobs/remind_rfq_suppliers_job'
import PurgeActivityEventsJob from '#jobs/purge_activity_events_job'

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

/**
 * Expiration quotidienne des demandes de devis dont l'échéance est dépassée.
 * Une échéance est une date : la demande est échue le lendemain à 00:00 (heure de
 * Paris), le job passe donc juste après minuit pour que le statut soit juste dès
 * le matin — cf. `RfqService#expireDue`.
 */
await ExpireRfqsJob.schedule({}).id('expire-rfqs').cron('10 0 * * *').timezone('Europe/Paris').run()

/**
 * Relance quotidienne des fournisseurs qui n'ont pas ouvert une demande reçue.
 * En matinée, heure de Paris : le mail arrive pendant les heures ouvrées.
 */
await RemindRfqSuppliersJob.schedule({})
  .id('remind-rfq-suppliers')
  .cron('0 9 * * *')
  .timezone('Europe/Paris')
  .run()

/**
 * Rétention quotidienne des consultations (#172) : pseudonymisation de
 * l'utilisateur après 90 jours, suppression après 24 mois. De nuit, heure de
 * Paris : aucune contrainte de fraîcheur.
 */
await PurgeActivityEventsJob.schedule({})
  .id('purge-activity-events')
  .cron('45 3 * * *')
  .timezone('Europe/Paris')
  .run()
