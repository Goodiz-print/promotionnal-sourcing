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

```typescript
import mail from '@adonisjs/mail/services/main'
import WelcomeNotification from '#mails/welcome_notification'

// Envoi immédiat
await mail.send(new WelcomeNotification(user))

// Envoi en file d'attente (recommandé)
await mail.sendLater(new WelcomeNotification(user))
```

## Templates Edge

Les templates sont dans `resources/views/emails/`. Les `globals` définis dans `config/mail.ts` (`brandName`, `appUrl`) sont disponibles dans tous les templates sans les passer explicitement.

## Tests

```typescript
import { createMailFaker } from '@adonisjs/mail'
import mail from '@adonisjs/mail/services/main'

const { mails } = mail.fake()

// … déclencher l'envoi …

mails.assertSent(WelcomeNotification, ({ message }) => {
  return message.to!.address === 'user@example.com'
})

mail.restore()
```

## Références

- [AdonisJS Mail — documentation officielle](https://docs.adonisjs.com/guides/digging-deeper/mail)
