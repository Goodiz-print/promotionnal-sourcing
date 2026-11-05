# Modération de la messagerie (administration)

> Date : 2026-11-04

Issue #167 : la plateforme consulte, modère et peut bloquer les conversations acheteur ↔ fournisseur ; les participants signalent un message.

## Base de données

- `message_reports` (`1794000000001_create_message_reports_table.ts`) : un signalement par message et par signalant (unicité), motif, précisions, statut `open` / `resolved`, résolution `dismissed` / `hidden` / `warned`, note et auteur de la décision. Supprimé avec son message ; survit au départ du signalant (`SET NULL`).
- `messages.hidden_at` / `hidden_by_user_id` et `conversations.blocked_at` / `blocked_reason` / `blocked_by_user_id` (`1794000000002_alter_messaging_add_moderation.ts`). Un message masqué garde son corps en base (preuve) ; seule la plateforme le lit encore.

## Côté participant

- `POST /:locale/messages/:id/report` (`messages.report`, `MessageReportController`), corps `{ reason: 'spam' | 'abuse' | 'off_platform' | 'fraud' | 'other', details? }`. Il faut appartenir à l'une des deux organisations du fil ; sinon 404 (pas de fuite d'existence). Signaler son propre message : 422. Signaler deux fois le même message met à jour le signalement encore ouvert (un signalement déjà traité n'est jamais rouvert).
- Un message masqué n'est plus renvoyé aux participants (`ConversationService.messagesOf`).
- Signaler un message déjà traité n'envoie rien : le message affiché l'indique (`messaging.flash.alreadyHandled`). Deux premiers signalements simultanés ne créent pas d'erreur (l'unicité départage).
- Un fil bloqué refuse tout nouveau message (`ConversationBlockedException`, 409) ; la lecture reste possible.
- Aucun écran de conversation n'existe encore côté utilisateur : le bouton « Signaler » viendra s'y brancher sur cette route.

## Côté plateforme (droit `moderation.manage` : admin et modérateur)

- `GET /admin/messaging` : liste des fils **sans contenu** (messages, signalements ouverts, dernier message, blocage), filtres acheteur / fournisseur / signalements ouverts / bloqués.
- `GET /admin/messaging/reports` : file des signalements (ouverts par défaut, du plus ancien au plus récent), avec un extrait du message.
- `GET /admin/messaging/conversations/:id` : fil complet, messages et signalements. **Chaque ouverture écrit `conversation.viewed`** dans la même transaction que la lecture : sans trace, pas de lecture.
- Décisions (une trace d'audit chacune, dans la même transaction ; 409 si l'action est sans objet) :
  - `POST /admin/messaging/messages/:id/hide` / `unhide` : masque ou réaffiche un message. Masquer clôt les signalements ouverts du message (résolution `hidden`).
  - `POST /admin/messaging/messages/:id/warn` (un seul avertissement par message, 409 ensuite) : notification in-app `message.warned` à l'auteur ; clôt les signalements ouverts (résolution `warned`).
  - `POST /admin/messaging/reports/:id/dismiss` : classe sans suite.
  - `POST /admin/messaging/conversations/:id/block` (motif obligatoire) / `unblock`.
- Audit : `conversation.viewed`, `conversation.blocked`, `conversation.unblocked`, `message.hidden`, `message.unhidden`, `message.warned`, `message_report.dismissed` (cibles `conversation`, `message`, `message_report`).
- Onglet « Messagerie » du back-office ; clés i18n `admin.messaging.*`, `messaging.flash.reported`, `notifications.types.message.warned` dans les 9 langues.

## À valider avant ouverture

- Cadre légal / RGPD de l'accès des administrateurs aux messages (mentionné dans l'issue) : durée de conservation, information des utilisateurs dans les CGU. L'accès est en tout cas limité à `moderation.manage` et tracé.
