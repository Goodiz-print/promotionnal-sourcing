# Système de mail (@adonisjs/mail)

> Date : 2026-06-26

Installation et configuration de `@adonisjs/mail` avec le transport SMTP.

- **Package** : `@adonisjs/mail@10.3.0`
- **Fichiers ajoutés** :
  - `config/mail.ts` — configuration SMTP avec auth conditionnelle (désactivée si `SMTP_USERNAME` vide, pour Mailpit)
  - `app/mails/welcome_notification.ts` — mail de bienvenue post-inscription
  - `resources/views/emails/welcome.edge` — template Edge du mail de bienvenue
  - `docs/mail.md`
- **`adonisrc.ts`** : ajout du provider `@adonisjs/mail/mail_provider` et des commandes `@adonisjs/mail/commands`
- **`start/env.ts`** : ajout des variables `SMTP_*`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`
- **Comportement notable** :
  - Auth SMTP désactivée automatiquement si `SMTP_USERNAME` est vide (compatible Mailpit en local)
  - `globals` Edge disponibles dans tous les templates : `brandName`, `appUrl`
  - Envoi en queue : `await mail.sendLater(new WelcomeNotification(user))`
- **En dev** : Mailpit (`brew install mailpit`) — interface sur http://localhost:8025
- **Doc** : [docs/mail.md](./mail.md)
