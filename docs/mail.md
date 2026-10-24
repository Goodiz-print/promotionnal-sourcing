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

| `kind`                    | Classe                               | Template Edge                    | Déclencheur                                                                             |
| ------------------------- | ------------------------------------ | -------------------------------- | --------------------------------------------------------------------------------------- |
| `organization-invitation` | `OrganizationInvitationNotification` | `emails/organization_invitation` | Invitation d'un membre (`OrganizationInvitationsController`)                            |
| `rfq-received`            | `RfqReceivedNotification`            | `emails/rfq_received`            | Envoi d'une demande de devis (`RfqNotificationService`)                                 |
| `rfq-reminder`            | `RfqReminderNotification`            | `emails/rfq_reminder`            | Relance unique d'un fournisseur qui n'a pas ouvert la demande (`RemindRfqSuppliersJob`) |
| `password-reset`          | `PasswordResetNotification`          | `emails/password_reset`          | Demande « mot de passe oublié » (`PasswordResetService`)                                |
| `email-verification`      | `EmailVerificationNotification`      | `emails/email_verification`      | Inscription, renvoi (`EmailVerificationService`)                                        |

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

## Références

- [AdonisJS Mail — documentation officielle](https://docs.adonisjs.com/guides/digging-deeper/mail)
