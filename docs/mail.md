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
```

En dev, utiliser [Mailpit](https://mailpit.axllent.org/) (`brew install mailpit`) — interface sur http://localhost:8025.

## Créer une mail class

```typescript
// app/mails/order_confirmation.ts
import { BaseMail } from '@adonisjs/mail'
import type Order from '#models/order'

export default class OrderConfirmation extends BaseMail {
  subject = 'Votre commande est confirmée'

  constructor(private order: Order) {
    super()
  }

  prepare() {
    this.message
      .to(this.order.user.email)
      .htmlView('emails/order_confirmation', { order: this.order })
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

await SendMailJob.dispatch({
  kind: MAIL_KINDS.organizationInvitation,
  to: invitation.email,
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
- **Échec définitif** : `failed()` loggue `{ err, to, kind }` et
  l'enregistrement est conservé **30 jours** dans `queue_jobs`
  (`removeOnFail: { age: '30d' }`) pour inspection ou rejeu manuel.
- ⚠️ **Pas d'idempotence** : si l'échec survient _après_ la remise SMTP, le
  rejeu renvoie le mail. Bénin pour une invitation ou une notification de
  demande de devis (un mail, un destinataire) ; à traiter (clé d'idempotence)
  avant de brancher devis et commandes.

### Types de mail existants

| `kind`                    | Classe                               | Template Edge                    | Déclencheur                                                  |
| ------------------------- | ------------------------------------ | -------------------------------- | ------------------------------------------------------------ |
| `organization-invitation` | `OrganizationInvitationNotification` | `emails/organization_invitation` | Invitation d'un membre (`OrganizationInvitationsController`) |
| `rfq-received`            | `RfqReceivedNotification`            | `emails/rfq_received`            | Envoi d'une demande de devis (`RfqNotificationService`)      |

`rfq-received` porte un chemin **relatif** (`rfqPath`) et non une URL absolue :
la charge est persistée et peut être rejouée bien plus tard, éventuellement sous
un autre domaine. Le template la préfixe avec le global `appUrl`. Le mail
d'invitation, lui, porte une URL signée complète — la signature couvre l'URL.

> ⚠️ **Le worker doit tourner** (`node ace queue:work`) : sans lui, les mails
> restent en base sans jamais partir. Voir [`docs/queue.md`](./queue.md#démarrer-le-worker).

### Ajouter un type de mail

1. Créer la mail class dans `app/mails/` (voir ci-dessus).
2. Ajouter le discriminant dans `MAIL_KINDS` et l'interface de données
   correspondante dans `shared/types/mail.ts`. `to` est **hissé hors de `data`**
   (commun à tous les mails, il permet de loguer le destinataire sans connaître
   le `kind`).
3. Traiter le nouveau `kind` dans `SendMailJob#buildMail()` — le `switch` est
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

await mail.send(new WelcomeNotification(user))
```

## Templates Edge

Les templates sont dans `resources/views/emails/`. Les `globals` définis dans `config/mail.ts` (`brandName`, `appUrl`) sont disponibles dans tous les templates sans les passer explicitement.

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
qui déclenche le rejeu), `kind` inconnu, politique de retry.

## Références

- [AdonisJS Mail — documentation officielle](https://docs.adonisjs.com/guides/digging-deeper/mail)
