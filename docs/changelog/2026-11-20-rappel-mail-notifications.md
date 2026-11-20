# Rappel par mail des notifications importantes non lues

> Date : 2026-11-20

Issue #243. Une notification in-app d'un type « à rappeler », encore non lue après un délai propre à son type, déclenche **un seul** mail de rappel vers son destinataire.

- **Politique par type** : `NOTIFICATION_EMAIL_FALLBACK` (`shared/types/notification.ts`). Premier type branché : `subscription.duplicate_cancelled`, envoyé aux administrateurs de la plateforme, avec un délai de 30 minutes. Les autres types ne changent pas.
- **Donnée** : nouvelle colonne `notifications.email_reminded_at` (nullable) et index partiel `notifications_pending_email_reminder_index` sur les notifications non lues et sans rappel.
- **Job planifié** : `SendNotificationRemindersJob`, toutes les 5 minutes (planning `send-notification-reminders`, lançable à la main depuis le back-office). Il passe par `NotificationReminderService#sendDue`.
- **Pas de doublon** : chaque notification est réservée par une mise à jour sur une sélection `FOR UPDATE SKIP LOCKED`, et le mail est mis en queue dans la même transaction. La clé d'idempotence est par notification.
- **Mail** : `notification-reminder` (`NotificationReminderNotification`, template `emails/notification_reminder`). Il reprend le texte de la notification dans la langue du destinataire, avec un lien vers l'écran concerné (`notificationHref`, désormais partagé avec la cloche). Les textes `emails.notificationReminder.*` existent dans les 9 langues.
- **Hors périmètre** : pas de réglage utilisateur, un seul rappel, pas de regroupement en digest.
- **Tests** : `tests/functional/notification_reminders.spec.ts` couvre le délai, la notification lue, le type sans politique, l'unicité sur passes répétées et la langue. `tests/unit/mail_templates.spec.ts` couvre le rendu dans les 9 langues.
