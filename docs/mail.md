# Système de mail (@adonisjs/mail)

## Configuration

- **Transport** : SMTP (Mailpit en local, SMTP auth en production)
- **Config** : `config/mail.ts`
- **Templates** : Edge (`resources/views/emails/`)

## Variables d'environnement

```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USERNAME=           # laisser vide pour Mailpit (auth désactivée)
SMTP_PASSWORD=
MAIL_FROM_ADDRESS=noreply@promotionnal-sourcing.com
MAIL_FROM_NAME=Promotionnal Sourcing
MAIL_ALERT_ADDRESS=      # optionnel : alertes d'échec définitif (vide = log seul)
```

En dev, utiliser [Mailpit](https://mailpit.axllent.org/) (`brew install mailpit`) — interface sur http://localhost:8025.

## Créer une mail class

Toute mail class étend **`LocalizedMail`** (`app/mails/localized_mail.ts`) : elle
reçoit la langue de son destinataire à la construction, et lit ses textes dans
`resources/lang/<locale>/emails.json` (voir [Langue du destinataire](#langue-du-destinataire)).

```typescript
// app/mails/order_confirmation.ts
import LocalizedMail from '#mails/localized_mail'
import type Order from '#models/order'
import type { Locale } from '#shared/types/i18n'

export default class OrderConfirmation extends LocalizedMail {
  constructor(
    private order: Order,
    locale: Locale
  ) {
    super(locale)
  }

  prepare() {
    this.message.to(this.order.user.email).subject(this.t('emails.orderConfirmation.subject'))
    this.htmlViewIn('emails/order_confirmation', { order: this.order })
  }
}
```

## Envoyer un mail

### Mails transactionnels → toujours par la queue (`SendMailJob`)

`mail.sendLater()` s'appuie sur la file **interne à `@adonisjs/mail`**, qui vit
**en mémoire dans le process HTTP** : un redémarrage (déploiement, crash,
scale-down) perd les mails en attente, un SMTP indisponible les perd aussi — sans
retry, sans trace. Il ne doit donc **pas** être utilisé pour un mail
transactionnel.

Les mails transactionnels passent par la **queue AdonisJS** (table `queue_jobs`,
cf. [`docs/queue.md`](./queue.md)) via `app/jobs/send_mail_job.ts` :

```typescript
import SendMailJob from '#jobs/send_mail_job'
import { MAIL_KINDS } from '#shared/types/mail'
import { mailSendKey } from '#shared/helpers/mail'

await SendMailJob.dispatch({
  kind: MAIL_KINDS.organizationInvitation,
  idempotencyKey: mailSendKey(MAIL_KINDS.organizationInvitation, { invitation: invitation.id }),
  to: invitation.email,
  locale: inviterLocale, // langue du destinataire, résolue ici (le worker n'a pas de requête)
  data: {
    organizationName: org.name,
    roleName: invitation.role.name,
    inviterName: invitedBy.fullName ?? invitedBy.email,
    acceptUrl,
  },
})
```

- Le job est **persisté en base** avant que la réponse HTTP ne parte : un
  redémarrage ne perd plus rien, le worker reprend là où il s'est arrêté.
- Côté worker, le job appelle `mail.send()` — envoi **synchrone** : la file,
  c'est la queue.
- **Retries** : 5 tentatives, backoff exponentiel (30 s → 15 min max).
- **Idempotence** : la charge porte une `idempotencyKey` (calculée à l'enqueue
  par `mailIdempotencyKey` / `mailSendKey`, `shared/helpers/mail.ts`) réservée dans
  `mail_deliveries` avant l'envoi. Clé déjà `sent` → le job sort sans rien
  envoyer ; un échec _après_ la remise ne renvoie donc plus le mail. Mail lié à
  un fait métier unique (devis) → clé déterministe ; envoi répétable
  (invitation renvoyée, nouveau lien) → `mailSendKey` (uuid par envoi).
- **Échec définitif / dead-letter** : `failed()` passe la ligne en `failed`
  (+ `error`), loggue `{ err, to, kind, idempotencyKey }`, émet `MailDeliveryFailed`
  (listener : log `error` + mail à `MAIL_ALERT_ADDRESS`). Le `queue_jobs` reste
  conservé 30 jours (`removeOnFail`).
- **Rejeu** : `node ace mail:retry <idempotencyKey>` ou `node ace mail:retry --all-failed`.
- Limite : une erreur levée _par_ `mail.send()` est indiscernable d'un mail non
  remis ; le rejeu peut alors produire un doublon (jamais une perte).

```sql
SELECT idempotency_key, kind, "to", attempts, error FROM mail_deliveries WHERE status = 'failed';
```

### Types de mail existants

| `kind`                    | Classe                               | Template Edge                    | Déclencheur                                                                                  |
| ------------------------- | ------------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------- |
| `organization-invitation` | `OrganizationInvitationNotification` | `emails/organization_invitation` | Invitation d'un membre (`OrganizationInvitationsController`)                                 |
| `rfq-received`            | `RfqReceivedNotification`            | `emails/rfq_received`            | Envoi d'une demande de devis (`RfqNotificationService`)                                      |
| `rfq-reminder`            | `RfqReminderNotification`            | `emails/rfq_reminder`            | Relance unique d'un fournisseur qui n'a pas ouvert la demande (`RemindRfqSuppliersJob`)      |
| `quote-received`          | `QuoteReceivedNotification`          | `emails/quote_received`          | Un fournisseur remet un devis : prévient les responsables de l'acheteur (`OnQuoteSubmitted`) |
| `password-reset`          | `PasswordResetNotification`          | `emails/password_reset`          | Demande « mot de passe oublié » (`PasswordResetService`)                                     |
| `email-verification`      | `EmailVerificationNotification`      | `emails/email_verification`      | Inscription, renvoi (`EmailVerificationService`)                                             |
| `contact-request`         | `ContactRequestNotification`         | `emails/contact_request`         | Formulaire de contact de la landing (`ContactRequestService`) — mail interne, en français    |

`rfq-received` porte un chemin **relatif** (`rfqPath`) et non une URL absolue :
la charge est persistée et peut être rejouée bien plus tard, éventuellement sous
un autre domaine. Le template la préfixe avec le global `appUrl`. Le mail
d'invitation et celui de réinitialisation de mot de passe, eux, portent une URL signée
complète — la signature couvre l'URL.

> ⚠️ **Le worker doit tourner** (`node ace queue:work`) : sans lui, les mails
> restent en base sans jamais partir. Voir [`docs/queue.md`](./queue.md#démarrer-le-worker).

### Langue du destinataire

Chaque mail est rédigé **dans la langue de la personne qui le reçoit** (#58) : le
sujet, le corps, les pluriels, les dates et le lien (préfixé par la locale). Le
worker n'a ni requête HTTP ni utilisateur connecté, donc la langue voyage dans la
charge du job (`locale`, au même niveau que `to`) et est **résolue par l'appelant à
la mise en queue** :

| Mail                                   | Langue retenue                                                                                                                                                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rfq-received`                         | `users.locale` de chaque membre habilité (`RFQ_RESPONDER_ROLES`) ; pour une adresse de contact d'organisation, celle du premier membre habilité (le plus ancien), à défaut la langue par défaut — un même envoi peut donc partir en plusieurs langues |
| `organization-invitation`              | celle de **l'inviteur** (l'invité n'a pas encore de compte) ; le lien d'acceptation pointe vers la même                                                                                                                                               |
| `password-reset`, `email-verification` | celle de la page d'où la demande est faite                                                                                                                                                                                                            |
| `welcome`                              | `users.locale` du compte                                                                                                                                                                                                                              |

Une charge mise en queue avant #58 n'a pas de `locale` : `SendMailJob` retombe sur
la langue par défaut (`fr`). La charge d'un mail en dead-letter conserve sa langue,
`mail:retry` le rejoue donc dans la même.

**Textes** : `resources/lang/<locale>/emails.json`, clés `emails.<mail>.<texte>`, dans
les **9 langues** (`SUPPORTED_LOCALES`), au format ICU (pluriels : `{hours, plural, one
{# heure} other {# heures}}`, avec `few`/`many` en polonais). Un test vérifie que les
neuf fichiers ont exactement les mêmes clés. Ces clés ne sont **pas** exposées au
frontend (filtrées dans `InertiaMiddleware`).

**Gabarits** : `resources/views/emails/layout.edge` est le gabarit commun (en-tête,
titre, pied « envoyé automatiquement »), utilisé comme composant :

```edge
@let(title = t('emails.passwordReset.title'))
@component('emails/layout', {
  title,
  locale,
  i18n,
  footer: t('emails.passwordReset.ignore'),
})
  <p>{{ t('emails.passwordReset.body', { brandName }) }}</p>
@end
```

⚠️ `locale` et `i18n` doivent être passés au composant : l'état d'un composant Edge
est isolé, et sans `i18n` le helper `t()` retomberait sur la langue par défaut.
`LocalizedMail#htmlViewIn()` pose `i18n`, `locale` et `brandName` dans l'état de vue.

Les textes ne contiennent **aucune balise HTML** : les valeurs saisies par des
utilisateurs (nom d'acheteur, titre de demande…) restent échappées par Edge. Pas de
gras dans un paragraphe traduit, donc pas de `{{{ }}}`.

**Exception** : `MailDeliveryFailedAlert` (alerte interne vers `MAIL_ALERT_ADDRESS`)
reste en français — son destinataire est l'équipe technique, pas un utilisateur de la
plateforme.

### Ajouter un type de mail

1. Créer la mail class dans `app/mails/` (voir ci-dessus).
2. Ajouter le discriminant dans `MAIL_KINDS` et l'interface de données
   correspondante dans `shared/types/mail.ts`. `to` et `locale` sont **hissés hors
   de `data`** (communs à tous les mails : `to` permet de loguer le destinataire
   sans connaître le `kind`, `locale` est la langue du destinataire).
   Ajouter les textes dans `emails.json` des **9** langues.
3. Choisir sa clé d'idempotence à l'enqueue (`mailIdempotencyKey` si le mail est lié à un fait métier unique, `mailSendKey` sinon).
4. Traiter le nouveau `kind` dans `SendMailJob#buildMail()` — le `switch` est
   exhaustif, l'oublier est une **erreur de compilation**.

La charge transite par la base : elle doit rester **sérialisable**. Aucune
instance de mailer ni de modèle Lucid — uniquement des données déjà résolues
(destinataire, libellés, URL signée…) ou des identifiants rechargés dans
`execute()`.

### Envoi direct

Réservé aux cas où la queue n'a pas de sens (commande ace ponctuelle, script) :

```typescript
import mail from '@adonisjs/mail/services/main'
import WelcomeNotification from '#mails/welcome_notification'

await mail.send(new WelcomeNotification(user)) // langue : user.locale
```

## Templates Edge

Les templates sont dans `resources/views/emails/`, tous construits sur `emails/layout.edge`. Les `globals` définis dans `config/mail.ts` (`brandName`, `appUrl`) sont disponibles dans tous les templates sans les passer explicitement.

## Tests

`QUEUE_DRIVER=sync` (positionné dans `.env.test` et en CI) exécute les jobs
**immédiatement, dans le process de test** : un mail mis en queue par un
controller est donc réellement envoyé et observable via `mail.fake()` — avec
`assertSent` (et non `assertQueued`, qui ne concerne que la file mémoire de
`@adonisjs/mail`).

```typescript
import mail from '@adonisjs/mail/services/main'

const { mails } = mail.fake()

// … déclencher l'envoi …

mails.assertSent(WelcomeNotification, ({ message }) => {
  return message.to!.address === 'user@example.com'
})

mail.restore()
```

Le job lui-même est couvert par `tests/unit/send_mail_job.spec.ts` :
reconstruction du mail depuis la charge, propagation de l'erreur SMTP (c'est ce
qui déclenche le rejeu), `kind` inconnu, politique de retry, idempotence et dead-letter ;
`mail_retry.spec.ts` et `on_mail_delivery_failed.spec.ts` couvrent `mail:retry` et l'alerte.

Le rendu par langue est couvert sans base par `tests/unit/mail_templates.spec.ts` (sujet
et HTML des 5 mails dans les 9 langues, pluriels, échappement, symétrie des
`emails.json`), et la langue de chaque destinataire d'une demande de devis par
`tests/functional/rfq_mail_locale.spec.ts`.

## Mails entrants (réponses des fournisseurs)

Un fournisseur répond à une demande de devis depuis sa messagerie : la plateforme reçoit la réponse, l'authentifie, la rattache au couple demande / fournisseur et la journalise (#223). Le choix du prestataire, Resend, est motivé dans l'[ADR 0005](adr/0005-reception-mails-entrants.md).

Cette brique s'arrête à la réception. Enregistrer la réponse comme un devis (#224), la transmettre à l'agence (#225) ou alimenter la messagerie (#226) se branche sur l'événement `InboundMailReceived`.

### Adresse relais

- Chaque couple demande / fournisseur a une adresse `rfq-<jeton>@<INBOUND_MAIL_DOMAIN>`.
- Le jeton (`rfq_suppliers.reply_token`, 32 caractères hexadécimaux) est aléatoire et généré par la base à l'insertion de la ligne.
- L'adresse est posée en `Reply-To` sur les mails `rfq-received` et `rfq-reminder` (`RfqNotificationService` → `InboundAddressService#addressFor`). Toutes les boîtes d'un même fournisseur reçoivent la même adresse.
- Ces deux mails portent aussi `X-Auto-Response-Suppress: OOF, AutoReply`, qui demande à Outlook et Exchange de ne pas y répondre par un message d'absence.
- **L'expéditeur n'authentifie rien** : un fournisseur répond souvent depuis une autre boîte. Le jeton fait foi ; `inbound_mails.sender_known` indique seulement si l'expéditeur est l'adresse de contact du fournisseur ou celle d'un de ses membres.
- L'adresse reste valide tant que la demande est publiée, puis `INBOUND_MAIL_GRACE_DAYS` jours (30 par défaut) après sa clôture ou son expiration.
- Sans configuration (dev, test, CI), aucun `Reply-To` n'est posé : les mails partent comme avant.

### Variables d'environnement

```env
INBOUND_MAIL_PROVIDER=resend          # `none` ou absent : réception désactivée
INBOUND_MAIL_DOMAIN=reply.example.com # sous-domaine dont les MX pointent vers Resend
INBOUND_MAIL_SIGNING_KEY=whsec_…      # secret du webhook (signature)
INBOUND_MAIL_API_KEY=re_…             # clé d'API : lecture du contenu des mails
INBOUND_MAIL_MAX_SIZE_MB=25           # optionnel
INBOUND_MAIL_MAX_ATTACHMENT_SIZE_MB=15 # optionnel
INBOUND_MAIL_GRACE_DAYS=30            # optionnel
```

La réception n'est active que si le prestataire, le domaine et les deux clés sont renseignés. `INBOUND_MAIL_API_KEY` est lue par le **worker** : la définir sur les deux applications.

### Parcours d'un mail

1. Resend reçoit le mail sur le sous-domaine relais et appelle `POST /webhooks/inbound-mail` (`webhooks.inbound_mail`). La route est hors locale, hors session, exemptée de CSRF (`config/shield.ts`).
2. `InboundMailService#receive` vérifie la signature Svix sur le **corps brut** (`svix-id`, `svix-timestamp`, `svix-signature`, écart d'horodatage de 5 minutes au plus), insère une ligne `inbound_mails` et met `ProcessInboundMailJob` en file.
3. Le job (`InboundMailService#process`) lit le corps, les en-têtes et les pièces jointes par l'API Resend, applique les garde-fous, copie les pièces jointes acceptées sur Cellar, puis émet `InboundMailReceived`.

Réponses du webhook :

| Cas                                        | Code                      | Effet                                                                  |
| ------------------------------------------ | ------------------------- | ---------------------------------------------------------------------- |
| Mail journalisé                            | 200, `receipt: queued`    | Traitement mis en file                                                 |
| Mail déjà journalisé                       | 200, `receipt: duplicate` | Rien, sauf s'il attendait encore son traitement : il est remis en file |
| Événement autre que `email.received`       | 200, `receipt: ignored`   | Rien                                                                   |
| Signature absente, fausse ou trop ancienne | 403                       | Rien n'est journalisé                                                  |
| Réception non configurée                   | 503                       | Rien                                                                   |
| Autre erreur                               | 500                       | Resend relance (8 tentatives sur environ 27 heures)                    |

### Idempotence

- `inbound_mails (provider, provider_message_id)` est unique, et l'insertion se fait en `ON CONFLICT DO NOTHING` : le même mail livré deux fois ne donne qu'une ligne.
- Le job prend le mail par une bascule conditionnelle `received | failed → processing` : deux jobs concurrents n'en traitent qu'un, et un mail `processed` ou `rejected` n'est jamais repris. Un verrou `processing` sans mouvement depuis 15 minutes est celui d'un worker tué en plein traitement : il peut être repris.
- `inbound_mail_attachments (inbound_mail_id, provider_attachment_id)` est unique : un job rejoué ne stocke pas deux fois la même pièce.

### Garde-fous

Appliqués dans cet ordre ; le premier qui s'applique écarte le mail (`status = rejected`, motif dans `rejection_reason`) :

| Motif             | Condition                                                                                                                                                                                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `too_large`       | Mail de plus de `INBOUND_MAIL_MAX_SIZE_MB`                                                                                                                                                                                                                                                                               |
| `loop`            | Expéditeur = `MAIL_FROM_ADDRESS` ou une adresse du domaine relais                                                                                                                                                                                                                                                        |
| `auto_reply`      | `Auto-Submitted` autre que `no`, `X-Auto-Response-Suppress: All` (les autres valeurs, posées par des CRM et des ERP sur des mails écrits par une personne, ne comptent pas), `X-Autoreply`, `Precedence: bulk/junk/list`, `Return-Path: <>`, rapport de non-remise, expéditeur `mailer-daemon`, `postmaster`, `no-reply` |
| `unknown_address` | Aucun couple ne porte ce jeton, ou l'adresse n'est pas une adresse relais                                                                                                                                                                                                                                                |
| `expired_address` | Demande close ou expirée depuis plus de `INBOUND_MAIL_GRACE_DAYS` jours                                                                                                                                                                                                                                                  |

Un mail écarté n'est que journalisé (expéditeur, adresse visée, objet, en-têtes) : son corps et ses pièces jointes ne sont pas conservés.

Pièces jointes d'un mail accepté, chacune journalisée dans `inbound_mail_attachments` :

| Statut           | Condition                                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stored`         | Extension acceptée (`INBOUND_ATTACHMENT_TYPES` : PDF, PNG, JPEG, WebP, Word, Excel, OpenDocument, CSV), copiée sur Cellar par `StorageService#storeContent` |
| `rejected_type`  | Autre extension                                                                                                                                             |
| `rejected_size`  | Plus de `INBOUND_MAIL_MAX_ATTACHMENT_SIZE_MB`                                                                                                               |
| `ignored_inline` | Image intégrée au corps (logo de signature)                                                                                                                 |

Une pièce refusée n'écarte pas le mail.

### Journal

`inbound_mails` : `provider`, `provider_message_id`, `message_id`, `rfq_supplier_id`, `recipient`, `sender_address`, `sender_name`, `sender_known`, `subject`, `text_body`, `html_body`, `headers`, `size_bytes`, `status` (`received`, `processing`, `processed`, `rejected`, `failed`), `rejection_reason`, `error`, `received_at`, `processed_at`.

Un mail `failed` porte l'erreur du dernier essai ; le job est rejoué 5 fois avec un backoff de 30 secondes à 15 minutes.

### Reprise des mails non aboutis

Resend ne relance pas un webhook auquel l'application a répondu 200 : un mail journalisé mais non traité ne reviendra pas de lui-même. `RecoverInboundMailsJob`, planifié toutes les 15 minutes (`start/scheduler.ts`), remet donc en file (`InboundMailService#recoverStale`) les mails sans mouvement depuis 15 minutes qui sont encore :

- `processing` : le worker a été tué en plein traitement (déploiement, crash) ;
- `failed` : le job a épuisé ses tentatives, par exemple pendant une panne de l'API du prestataire ;
- `received` : la mise en file s'est perdue.

La reprise dure 24 heures après la réception. Au-delà, le mail reste `failed` avec son erreur, pour la supervision (#227). Les deux durées sont dans `config/inbound_mail.ts` (`staleAfterMinutes`, `recoveryWindowHours`).

### Changer de prestataire

Le code dépend de la classe abstraite `InboundMailProvider` (`app/services/inbound_mail/`), liée dans `providers/inbound_mail_provider.ts`. Un autre prestataire s'ajoute par une implémentation de ses trois méthodes : `parseWebhook`, `fetchContent`, `fetchAttachment`.

### En local

Il n'y a ni MX ni webhook en développement. La commande suivante fait passer un mail par les mêmes garde-fous, sans prestataire ni file :

```bash
node ace inbound-mail:simulate rfq-<jeton>@reply.localhost \
  --from="Jean <jean@fournisseur.test>" --attachment=devis.pdf
```

`--auto-reply` simule un message d'absence. Pour que les mails de demande portent un `Reply-To` en local, renseigner les quatre variables (des valeurs factices suffisent pour le domaine et les clés).

### Tests

`tests/functional/inbound_mail.spec.ts` couvre le webhook (rattachement, doublon, réponse automatique, adresse inconnue ou expirée, signature invalide, pièces jointes, reprise après échec) et le `Reply-To`. `tests/unit/inbound_mail_helpers.spec.ts` couvre l'adresse relais, la détection des réponses automatiques et la signature Svix (vecteur de la documentation Svix). Le faux prestataire est dans `tests/utils/inbound_mail.ts` (`useFakeInboundMail(group)`).

## Références

- [AdonisJS Mail — documentation officielle](https://docs.adonisjs.com/guides/digging-deeper/mail)
