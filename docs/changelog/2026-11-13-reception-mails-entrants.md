# Réception des mails entrants (réponses des fournisseurs)

> Date : 2026-11-13

Fondation du parcours devis par mail (#223) : un fournisseur répond à une demande de devis depuis sa messagerie, la plateforme reçoit la réponse, l'authentifie, la rattache au couple demande / fournisseur et la journalise. Détail dans `docs/mail.md` (section « Mails entrants ») ; choix du prestataire dans l'ADR 0005.

## Décision

- Resend reçoit les mails sur un sous-domaine dédié et notifie l'application par webhook (`docs/adr/0005-reception-mails-entrants.md`). Point ouvert consigné dans l'ADR : le lieu de stockage des mails reçus chez Resend reste à confirmer par écrit.

## Adresse relais

- Nouvelle colonne `rfq_suppliers.reply_token` (32 caractères hexadécimaux, unique, générée par la base, remplie pour les lignes existantes).
- Les mails `rfq-received` et `rfq-reminder` portent en `Reply-To` l'adresse `rfq-<jeton>@<INBOUND_MAIL_DOMAIN>` et l'en-tête `X-Auto-Response-Suppress`. `RfqReceivedMailData` et `RfqReminderMailData` gagnent le champ optionnel `replyTo`.
- Sans configuration, aucun `Reply-To` n'est posé.

## Réception

- Route `POST /webhooks/inbound-mail` (`webhooks.inbound_mail`) : hors locale, hors session, exemptée de CSRF, authentifiée par la signature Svix du prestataire. 200 quand le mail est journalisé (doublon et adresse inconnue compris), 403 si la signature est invalide, 503 si la réception n'est pas configurée.
- Tables `inbound_mails` (journal, unique sur `provider` + `provider_message_id`) et `inbound_mail_attachments` (pièces jointes, référencée dans `STORAGE_REFERENCES`).
- `ProcessInboundMailJob` lit le contenu chez le prestataire, applique les garde-fous et copie les pièces jointes acceptées sur Cellar.
- `RecoverInboundMailsJob`, toutes les 15 minutes : remet en file les mails restés `processing` (worker tué), `failed` (tentatives épuisées) ou `received` (mise en file perdue), pendant 24 heures après la réception.
- Garde-fous : `too_large`, `loop`, `auto_reply`, `unknown_address`, `expired_address`. Pièces jointes : `stored`, `rejected_type`, `rejected_size`, `ignored_inline`.
- Événement `InboundMailReceived` (`inboundMailId`, `rfqSupplierId`) émis pour chaque réponse acceptée. Aucun écouteur pour l'instant : le statut du couple et la création du devis relèvent de #224.

## Configuration

- Variables `INBOUND_MAIL_PROVIDER`, `INBOUND_MAIL_DOMAIN`, `INBOUND_MAIL_SIGNING_KEY`, `INBOUND_MAIL_API_KEY`, `INBOUND_MAIL_MAX_SIZE_MB`, `INBOUND_MAIL_MAX_ATTACHMENT_SIZE_MB`, `INBOUND_MAIL_GRACE_DAYS` (`start/env.ts`, `.env.example`, `config/inbound_mail.ts`). La clé d'API est nécessaire sur le web et le worker.
- Abstraction `InboundMailProvider` liée dans `providers/inbound_mail_provider.ts` (Resend, ou prestataire inerte).
- Commande `node ace inbound-mail:simulate <adresse relais>` pour le développement.

## Tests

- `tests/functional/inbound_mail.spec.ts`, `tests/unit/inbound_mail_helpers.spec.ts`, faux prestataire `tests/utils/inbound_mail.ts`.
