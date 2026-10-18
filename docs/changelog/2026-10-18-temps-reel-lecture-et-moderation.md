# Temps réel, suivi de lecture et effet de la modération

Date : 2026-10-18

- **Notifications en temps réel** : diffusion sur `notifications/users/:userId` à chaque création (`notification.created`). Canal réservé à son destinataire.
- **Messages en temps réel** : diffusion sur `conversations/:id` (`message.posted`). Canal réservé aux membres des deux organisations du fil.
- **Suivi de lecture des messages** (`conversation_reads`) : `markRead` (idempotent), `unreadCount` par participant.
- **Modération** : un produit rejeté n'apparaît plus dans le catalogue public (liste et fiche). Son fournisseur le voit toujours.
- **Non couvert** : client Transmit côté interface (cloche de notifications, #57), transport partagé pour plusieurs instances.
