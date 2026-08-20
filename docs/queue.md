# Système de queue — @adonisjs/queue

## Vue d'ensemble

Le système de queue permet d'exécuter des tâches lourdes en arrière-plan (envoi d'emails, traitement IA, compression de fichiers, etc.) sans bloquer la réponse HTTP.

- **Package** : `@adonisjs/queue` (officiel AdonisJS, expérimental)
- **Driver** : `database` — utilise PostgreSQL via Lucid (pas de Redis requis)
- **Tables** : `queue_jobs`, `queue_schedules`

## Configuration

Fichier : `config/queue.ts`

```typescript
import env from '#start/env'
import { defineConfig, drivers } from '@adonisjs/queue'

export default defineConfig({
  default: env.get('QUEUE_DRIVER', 'database'),

  adapters: {
    database: drivers.database({ connectionName: 'pg' }),
    sync: drivers.sync(), // pour les tests
  },

  worker: {
    concurrency: 5,
    idleDelay: '2s',
  },

  locations: ['./app/jobs/**/*.{ts,js}'],
})
```

Variable d'environnement : `QUEUE_DRIVER=database` (valeurs possibles : `redis`, `database`, `sync`)

## Créer un job

```bash
node ace make:job nom_du_job
```

Exemple (`app/jobs/send_email.ts`) :

```typescript
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'

interface Payload {
  userId: number
  templateKey: string
}

export default class SendEmail extends Job<Payload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  async execute() {
    const { userId, templateKey } = this.payload
    // logique d'envoi d'email
  }

  async failed(error: Error) {
    // appelé après épuisement des retries
  }
}
```

## Dispatcher un job

Depuis un service ou un controller :

```typescript
import SendEmail from '#jobs/send_email'

await SendEmail.dispatch({ userId: user.id, templateKey: 'welcome' })
```

Options disponibles :

```typescript
await SendEmail.dispatch(payload)
  .toQueue('emails') // file dédiée
  .priority(1) // priorité haute
  .delay('5m') // délai avant exécution
```

## Planifier un job (cron)

Fichier : `start/scheduler.ts`

```typescript
import SendWeeklyReport from '#jobs/send_weekly_report'

SendWeeklyReport.schedule({ type: 'weekly' }).cron('0 9 * * MON').run()
```

Le fichier n'est préchargé qu'en environnement `web` (`adonisrc.ts`) : les jobs
planifiés ne tournent donc pas pendant les tests.

Jobs planifiés actuels :

| Job                          | Fréquence                   | Rôle                                                                                                                                           |
| ---------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `PurgeExpiredInvitationsJob` | `15 3 * * *` (Europe/Paris) | Bascule les invitations d'organisation échues en `expired`, puis supprime celles en état terminal après 90 jours (cf. `docs/organisations.md`) |

## Démarrer le worker

Le worker doit tourner en tant que **processus séparé** :

```bash
node ace queue:work
# ou avec options
node ace queue:work --queue=emails,notifications --concurrency=10
```

En production, utiliser PM2 ou un service systemd pour maintenir le processus actif.

## Variables d'environnement

| Variable       | Valeur par défaut | Description                                     |
| -------------- | ----------------- | ----------------------------------------------- |
| `QUEUE_DRIVER` | `database`        | Driver à utiliser (`database`, `redis`, `sync`) |
| `DB_HOST`      | `localhost`       | Hôte PostgreSQL                                 |
| `DB_PORT`      | `5430`            | Port PostgreSQL                                 |
| `DB_USER`      | —                 | Utilisateur PostgreSQL                          |
| `DB_PASSWORD`  | —                 | Mot de passe PostgreSQL                         |
| `DB_DATABASE`  | —                 | Nom de la base                                  |

## Notes

- Le driver `sync` exécute les jobs immédiatement sans worker — pratique pour les tests.
- Le package est marqué **expérimental** : épingler la version dans `package.json`.
- Les jobs sont stockés dans la table `queue_jobs` ; inspecter cette table pour débugger.
