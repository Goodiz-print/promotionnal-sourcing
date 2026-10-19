# Idempotence des mails transactionnels et dead-letter (#59)

> Date : 2026-10-19

Un échec survenu **après** la remise SMTP ne fait plus renvoyer le mail au rejeu,
et un mail définitivement en échec est tracé, signalé et rejouable.

## Idempotence

- `SendMailPayload` porte une **`idempotencyKey`**, calculée à la mise en queue
  (`shared/helpers/mail.ts`) :
  - fait métier unique → clé déterministe, ex. `rfq-received:org=7:rfq=12:to=contact@x.fr` ;
  - envoi qui peut légitimement se répéter (invitation renvoyée, nouveau lien de
    mot de passe / de vérification) → `mailSendKey` ajoute un `send=<uuid>` : la
    clé dédoublonne les rejeux d'un envoi, pas deux envois voulus.
- Nouvelle table **`mail_deliveries`** (`idempotency_key` unique, `kind`, `to`,
  `status` `sent` | `failed`, `sent_at`, `error`, `attempts`, `payload`).
  `payload` garde la charge tant que le mail n'est pas parti (rejeu) et est
  **vidé à l'envoi** (URL signées).
- `SendMailJob#execute` réserve la clé (`INSERT … ON CONFLICT DO NOTHING`) avant
  `mail.send()`. Clé déjà `sent` → sortie silencieuse (log `info`). Envoi réussi →
  `sent`. Échec → `failed` + erreur relancée (le retry de la queue est inchangé).
- Les jobs déjà en queue avant ce changement (sans clé) sont dédoublonnés par `jobId`.

## Dead-letter et alerting

- `SendMailJob#failed` (tentatives épuisées) écrit `failed` + `error` et émet
  l'événement **`MailDeliveryFailed`**.
- Le listener `OnMailDeliveryFailed` loggue en `error` (structuré) et envoie un
  mail à **`MAIL_ALERT_ADDRESS`** (optionnelle ; vide = log seul).
- Commande **`node ace mail:retry <idempotencyKey>`** ou **`--all-failed`** : remet
  en queue les mails `failed` avec leur clé ; un mail déjà `sent` n'est jamais renvoyé.

## Limites

- Une erreur levée _par_ `mail.send()` est indiscernable d'un mail non remis : le
  rejeu renvoie alors le mail (doublon possible, jamais de perte).
- L'écran `/admin/mail-deliveries` n'est pas livré (dépend du rôle super-admin).

## Tests

`tests/unit/send_mail_job.spec.ts`, `mail_retry.spec.ts`, `on_mail_delivery_failed.spec.ts`.
