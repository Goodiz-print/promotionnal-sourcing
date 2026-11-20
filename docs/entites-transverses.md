# Entités transverses

> Dernière mise à jour : 2026-10-18

Cinq entités partagées par plusieurs domaines (RFQ, catalogue, administration).
Elles sont conçues pour évoluer sans migration destructive : les types évoluent
dans `shared/types/`, pas dans le schéma.

| Entité                 | Table                  | Modèle                     | Fabrique                    | Service               | Points d'extension                 |
| ---------------------- | ---------------------- | -------------------------- | --------------------------- | --------------------- | ---------------------------------- |
| Notification           | `notifications`        | `Notification`             | `NotificationFactory`       | `NotificationService` | `NOTIFICATION_TYPES`               |
| Conversation           | `conversations`        | `Conversation`             | `ConversationFactory`       | `ConversationService` | RFQ optionnelle, sujet libre       |
| Message                | `messages`             | `Message`                  | `MessageFactory`            | `ConversationService` | corps borné (`MESSAGE_MAX_LENGTH`) |
| Import                 | `import_jobs`          | `ImportJob`                | `ImportJobFactory`          | `ImportJobService`    | `IMPORT_KINDS`, `IMPORT_STATUSES`  |
| Décision de modération | `moderation_decisions` | `ModerationDecisionRecord` | `ModerationDecisionFactory` | `ModerationService`   | `MODERATION_TARGET_TYPES`          |

## Principes communs

- **Pas d'enum SQL** pour les types, statuts ou cibles : des chaînes validées par
  le code (listes `as const` dans `shared/types/`). Ajouter une valeur = une ligne
  de code, pas une migration.
- **`down()` systématique**, et migrations jamais modifiées une fois appliquées.
- **Accès par services**, jamais dans un contrôleur. Les services utilisent le
  modèle Lucid ; aucun job chargé au boot n'importe ces modèles.
- **Erreurs métier** dans `app/exceptions/<domaine>_errors.ts`.

## Notifications (#57)

- `type` + `data` (JSON). Le `data` porte le contexte d'affichage (ids, libellés).
- `readAt` : lue ou non. `markRead` est idempotent et ne déplace pas la date de lecture.
- Lecture stricte : une notification d'un autre utilisateur donne une erreur 404,
  comme une notification inexistante.
- **Temps réel** : chaque notification est diffusée sur `notifications/users/:userId`
  (événement `notification.created`, sans contenu : l'id et le type). Seul son
  destinataire peut s'abonner à ce canal.

### Qui est notifié, et quand

`InAppNotificationService` traduit un événement métier en notifications pour les
membres qui peuvent **agir** (mêmes rôles que les mails) ; un `member` n'est pas
notifié d'une impasse. Un échec est loggué sans faire échouer la requête.

| Événement (publié par)                                   | Type                                              | Destinataires                                    |
| -------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------ |
| `RfqSent` (`RfqsController#send`)                        | `rfq.received`                                    | owner / admin / manager du fournisseur           |
| `RfqDeclined` (`supplier/RfqsController#decline`)        | `rfq.declined`                                    | owner / admin / manager de l'acheteur            |
| `QuoteSubmitted` (`QuoteService`)                        | `quote.received`                                  | owner / admin / manager de l'acheteur            |
| `QuoteAccepted` / `QuoteRejected` (`QuoteService`)       | `quote.accepted` / `.rejected`                    | owner / admin / manager du fournisseur           |
| `OrderCreated` (`OrderService`)                          | `order.created`                                   | owner / admin / manager du fournisseur           |
| `OrderConfirmed` / `OrderInProduction` / `OrderShipped`  | `order.confirmed` / `.in_production` / `.shipped` | owner / admin / manager de l'acheteur            |
| `OrderDelivered` (`OrderService`)                        | `order.delivered`                                 | owner / admin / manager du fournisseur           |
| `OrderCancelled` (`OrderService`)                        | `order.cancelled`                                 | l'autre côté que l'auteur de l'annulation        |
| `MemberJoined` (`InvitationAcceptanceController#accept`) | `organization.member_joined`                      | owner / admin de l'organisation, sauf l'arrivant |

Les listeners (`app/listeners/on_*.ts`) sont enregistrés dans `start/events.ts`. `OnRfqSent`
et `OnQuoteSubmitted` envoient aussi le mail : deux canaux indépendants.

### Écrans

- **Routes** : `GET /:locale/notifications` (`notifications.index`),
  `PATCH /:locale/notifications/:id/read` (marque lue **puis redirige** vers l'écran
  concerné, résolu par `NotificationTransformer` selon le type), `POST
/:locale/notifications/read-all`. Une notification d'un autre utilisateur donne une 404.
- **Props partagées** (`InertiaMiddleware`) : `unreadNotificationsCount` à chaque page ;
  `recentNotifications` (10 dernières) **optionnelle**, chargée à l'ouverture du menu.
- **Cloche** (`components/notifications/notification_bell.vue`, dans le bandeau) : pastille,
  menu, « tout marquer comme lu ». `useNotificationStream` s'abonne au canal Transmit
  (`@adonisjs/transmit-client`) ; à l'arrivée d'une notification : toast + rechargement
  partiel du compteur. Sans temps réel, le compteur reste exact à la navigation suivante.
- **Textes** : `resources/lang/{fr,en}/notifications.json`, un libellé par type
  (`notifications.types.<type>`) ; les autres langues retombent sur l'anglais
  (`ENGLISH_FALLBACK_NAMESPACES`).
- Ajouter un type : une entrée dans `NOTIFICATION_TYPES`, un libellé fr/en, un cas dans
  `notificationHref` (`app/transformers/notification_transformer.ts`), et l'appel dans
  `InAppNotificationService`.

### Rappel par mail des notifications non lues (#243)

Une alerte urgente ne doit pas rester invisible tant que son destinataire ne se connecte
pas. Certains types sont donc « à rappeler » :

- **Politique** : `NOTIFICATION_EMAIL_FALLBACK` (`shared/types/notification.ts`) associe un
  type à son délai (`delayMinutes`) et, au besoin, au rôle plateforme que le destinataire doit
  encore avoir (`recipientPlatformRole`). Types branchés :
  - `subscription.duplicate_cancelled` : 30 minutes, administrateurs uniquement ;
  - 24 heures pour les notifications des acheteurs et fournisseurs : `order.created`,
    `order.confirmed`, `order.in_production`, `order.shipped`, `order.cancelled`,
    `quote.accepted`, `quote.rejected`, `rfq.declined`, `message.warned`.

  Un type absent n'envoie jamais de mail. Les types qui ont déjà leur mail à la création
  (`rfq.received`, `quote.received`, `announcement`, invitation) restent hors de la table,
  pour ne pas envoyer deux mails. `order.delivered` et `organization.member_joined` n'y
  figurent pas non plus : ils sont informatifs.

- **Âge maximal** : une notification plus vieille que `NOTIFICATION_REMINDER_MAX_AGE_HOURS`
  (7 jours) n'est plus rappelée. Brancher un type n'envoie donc pas de rafale pour un vieil
  historique.
- **Job** : `SendNotificationRemindersJob`, toutes les 5 minutes (`start/scheduler.ts`,
  planning `send-notification-reminders`, lançable depuis le back-office). Il appelle
  `NotificationReminderService#sendDue`.
- **Un seul mail par notification** : une notification non lue, plus vieille que le délai de
  son type et sans rappel (`email_reminded_at` null) est réservée par un `UPDATE … SET
email_reminded_at` sur une sélection `FOR UPDATE SKIP LOCKED`, puis le mail est mis en queue
  dans la même transaction. Deux passes concurrentes ne prennent jamais la même ligne ; un
  rejeu du mail est absorbé par sa clé d'idempotence (`notification-reminder:notification=<id>`).
  Une notification lue avant le délai n'envoie rien.
- **Échec de mise en queue** : isolé ligne par ligne. Seule la notification en échec est
  libérée (`email_reminded_at` remis à null, reprise à la passe suivante) ; les autres mails du
  lot gardent leur réservation. Lots de 50 par type et par passe.
- **Mail** : `notification-reminder` (`NotificationReminderNotification`). Il reprend le texte
  de la notification (`notifications.types.<type>`) dans la langue du destinataire et pointe
  vers le même écran que la cloche (`notificationHref`, préfixé par `appUrl`). Le libellé du
  type doit donc exister dans les 9 langues (vérifié par `tests/unit/mail_templates.spec.ts`).
  Si le libellé manque ou ne peut pas être formaté (paramètre absent de `data`), le mail part
  sans ce texte, avec son lien, plutôt que d'échouer.
- Brancher un type : une entrée dans `NOTIFICATION_EMAIL_FALLBACK` (et son libellé dans les
  9 `notifications.json`). Ni réglage utilisateur, ni second rappel, ni regroupement.
- **Index** : `notifications_pending_email_reminder_index`, partiel
  (`read_at IS NULL AND email_reminded_at IS NULL`) sur `(type, created_at)`.

## Messagerie (#8)

- Un fil relie une organisation acheteuse et une organisation fournisseur. Il peut
  être rattaché à une RFQ ; si la RFQ disparaît, le fil reste (`rfq_id` passe à `NULL`).
- Seuls les **membres** des deux organisations peuvent lire ou écrire
  (`ConversationService.assertParticipant`).
- **Temps réel** : chaque message est diffusé sur `conversations/:id` (événement
  `message.posted`). Seuls les membres des deux organisations peuvent s'abonner.
- **Suivi de lecture** (`conversation_reads`) : un dernier message lu par participant.
  `markRead` est idempotent. `unreadCount` compte les messages postérieurs à la
  lecture et écrits par d'autres. Les messages propres ne sont jamais non lus.
- **Réponses reçues par mail** (#224) : la réponse d'un fournisseur à une demande de
  devis devient un message du fil de cette demande **pour ce destinataire**
  (`conversations.rfq_supplier_id`, un seul fil par destinataire, ouvert à la première
  réponse). Ce message n'a pas d'auteur (`author_user_id` nul) et porte
  `inbound_mail_id` (unique), l'expéditeur étant celui du mail. Ses fichiers sont dans
  `message_attachments` (`MessageAttachment`). Un fil bloqué reçoit quand même ces
  messages. Détail dans [`quotes.md`](quotes.md).

## Imports (#49, #77)

- Cycle : `pending` → `running` → `completed` | `failed`. Toute autre transition
  lève `ImportJobStateException`.
- Les erreurs de ligne sont stockées en JSON, bornées à `IMPORT_MAX_STORED_ERRORS`
  (100). `errorCount` reste exact au-delà. L'échec global est consigné en ligne 0.
- **Export CSV** (`ImportJobService.errorsToCsv`) : séparateur `;`, en-tête
  `ligne;colonne;message;valeur_recue`. Les valeurs commençant par `=`, `+`, `-` ou `@`
  sont neutralisées (injection de formules Excel).
- Le téléchargement HTTP n'est pas encore exposé : il viendra avec l'écran d'import.
- Un import échoué ne se relance pas : on crée un nouveau job.
- **Limite** : `recordRow` écrit une fois par ligne. Au-delà de quelques milliers
  de lignes, il faudra regrouper les écritures.

## Modération (#54)

- Historique en **ajout seul** : une décision n'est jamais modifiée. Le statut
  courant est la dernière décision ; sans décision, la cible est `pending`.
- Table polymorphe (`target_type` / `target_id`) : pas de clé étrangère, donc une
  cible supprimée garde son historique.
- Effet implémenté sur le **catalogue public** : un produit dont la dernière
  décision est `rejected` disparaît de la liste et de la fiche (`Product.notRejected`).
  Il reste visible de son fournisseur, pour qu'il puisse corriger.
- Un produit `pending` (sans décision) reste visible : les produits sont actifs à la
  création, la modération retire, elle ne valide pas.
- Une **organisation rejetée** masque ses produits et sa fiche fournisseur, dans le
  catalogue et l'annuaire (`Product.fromLiveOrganization`, `Supplier.fromLiveOrganization`).
  Elle ne peut donc plus afficher ses produits au public.
- Écrans back-office (#163) : file, historique et décision dans `/admin/moderation`
  (voir `docs/admin.md`).

## Temps réel : transport entre instances web

Par défaut, le transport Transmit est en mémoire (`config/transmit.ts`) : une
notification n'atteint que les navigateurs connectés à **la même instance** web. Avec
plusieurs instances (web ×2 en production, ADR 0003), on active le transport partagé
**`TRANSMIT_TRANSPORT=postgres`** : `PostgresTransport`
(`app/services/realtime/postgres_transport.ts`) relaie les diffusions par
`LISTEN` / `NOTIFY` sur la base déjà exploitée — pas de Redis à provisionner.

- Un canal PostgreSQL (`transmit_bus`) porte tout ; le nom du canal Transmit voyage dans
  l'enveloppe et chaque instance route localement. Une instance ne se rejoue pas ses messages.
- Deux connexions par instance web : une **dédiée** à l'écoute, un pool d'une connexion
  pour `pg_notify`. Rien ne se connecte avant le premier usage (le worker n'en ouvre pas).
- Limites : charge de `NOTIFY` plafonnée à ~8 000 octets (les événements ne portent que
  des identifiants ; un message trop gros est loggué et abandonné) ; livraison au mieux —
  une instance coupée rate les messages émis pendant la coupure, puis se réabonne seule
  (attente croissante, jusqu'à 30 s). L'état fait foi en base : la cloche est exacte à la
  navigation suivante.
- **Pas de pooler PgBouncer en mode transaction** entre l'application et la base :
  `LISTEN` exige une session.

## Questions ouvertes

- Modération des organisations : traitée (voir plus haut). Reste à décider si une
  organisation `pending` est visible (aujourd'hui oui, comme les produits).
