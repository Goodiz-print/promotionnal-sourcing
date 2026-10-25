# Notifications in-app : cloche, liste et temps réel (#57)

> Date : 2026-10-25

La table, le modèle, `NotificationService` et le canal Transmit existaient (entités transverses). Cette PR les branche sur le métier et les rend visibles.

- **Événements** (`app/events/`) : `RfqSent`, `RfqDeclined`, `MemberJoined`, qui s'ajoutent à `QuoteSubmitted` / `QuoteAccepted` / `QuoteRejected`. Listeners dans `app/listeners/`, enregistrés dans `start/events.ts`. `RfqsController#send` publie `RfqSent` au lieu d'appeler directement le service de mail : `OnRfqSent` envoie le mail **et** crée la notification.
- **`InAppNotificationService`** : un événement devient une notification pour les membres qui peuvent agir (mêmes rôles que les mails). Nouveaux types : `rfq.declined`, `quote.received`, `quote.accepted`, `quote.rejected`, `organization.member_joined`.
- **Routes** : `GET /:locale/notifications` (`notifications.index`), `PATCH /:locale/notifications/:id/read` (marque lue puis redirige vers l'écran concerné), `POST /:locale/notifications/read-all`. Cloisonnement par utilisateur (404 sinon).
- **Props partagées** : `unreadNotificationsCount` sur chaque page ; `recentNotifications` (10 dernières), chargée à l'ouverture du menu.
- **Frontend** : cloche avec pastille et menu dans le bandeau, page `notifications/index`, composable `useNotificationStream` (`@adonisjs/transmit-client`, nouvelle dépendance) : toast et mise à jour du compteur à l'arrivée d'une notification, sans recharger la page. Textes en `fr` / `en` (les autres langues retombent sur l'anglais).
- **Tests** : `notifications_inapp.spec.ts` (destinataires par rôle pour chaque événement, écrans, cloisonnement, props partagées) et `notification_bell.spec.ts` (Vitest).
- **Hors périmètre** : le temps réel n'atteint que le process web qui reçoit l'événement (transport Transmit en mémoire : avec plusieurs instances web il faudra un transport partagé, cf. `docs/entites-transverses.md`) ; pas de notification pour l'expiration ou la relance d'une demande ; les fournisseurs dont le devis est rejeté automatiquement à l'acceptation d'un autre ne sont pas notifiés (`QuoteService#accept` ne publie pas `QuoteRejected` pour eux).
