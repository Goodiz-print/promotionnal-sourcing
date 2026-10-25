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

### Jobs dispatchés à la demande

| Job                            | Dispatché depuis                                                                    | Rôle                                                                                                                                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SendMailJob`                  | Controllers / services envoyant un mail transactionnel                              | Envoie un mail via `mail.send()` côté worker (5 retries, backoff exponentiel 30 s → 15 min, échecs conservés 30 j), idempotent par `idempotencyKey` (`mail_deliveries`, dead-letter, `mail:retry`) — cf. `docs/mail.md` |
| `GenerateProductEmbeddingJob`  | `SupplierProductService` (création / mise à jour d'un produit)                      | Calcule l'embedding du produit et le persiste dans `products.embedding` (pgvector)                                                                                                                                      |
| `IndexProductJob`              | Événement `ProductChanged` (écriture produit, traduction, vecteur, modération)      | Aligne l'index de recherche sur la base pour un produit : réécrit son document s'il est visible, le retire sinon. No-op sans `MEILISEARCH_HOST` — cf. `docs/search.md`                                                  |
| `IndexOrganizationProductsJob` | Événement `OrganizationCatalogueChanged` (archivage, modération d'une organisation) | Même chose pour tout le catalogue d'une organisation                                                                                                                                                                    |
| `TranslateEntityJob`           | `TranslationQueueService` (produits, catégories, à la sauvegarde)                   | Traduit l'entité de sa langue source vers les autres langues de contenu (`is_auto = true`), sans écraser une traduction manuelle                                                                                        |

## Planifier un job (cron)

Fichier : `start/scheduler.ts`

```typescript
import SendWeeklyReport from '#jobs/send_weekly_report'

SendWeeklyReport.schedule({ type: 'weekly' }).cron('0 9 * * MON').run()
```

Le fichier n'est préchargé qu'en environnement `web` (`adonisrc.ts`) : les jobs
planifiés ne tournent donc pas pendant les tests.

Jobs planifiés actuels :

| Job                          | Fréquence                   | Rôle                                                                                                                                                                                                                                            |
| ---------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ExpireRfqsJob`              | `10 0 * * *` (Europe/Paris) | Bascule en `expired` les demandes de devis publiées dont l'échéance est dépassée (échues le lendemain à 00:00, heure de Paris), puis fait expirer leurs devis ouverts et ceux dont la validité est passée — cf. `docs/rfq.md`, `docs/quotes.md` |
| `RemindRfqSuppliersJob`      | `0 9 * * *` (Europe/Paris)  | Relance une fois les fournisseurs qui n'ont pas ouvert une demande reçue depuis `RFQ_REMINDER_AFTER_DAYS` jours — cf. `docs/rfq.md`                                                                                                             |
| `PurgeExpiredInvitationsJob` | `15 3 * * *` (Europe/Paris) | Bascule les invitations d'organisation échues en `expired`, puis supprime celles en état terminal après 90 jours (cf. `docs/organisations.md`)                                                                                                  |

## Démarrer le worker

Le worker doit tourner en tant que **processus séparé** :

```bash
node ace queue:work
# ou avec options
node ace queue:work --queue=emails,notifications --concurrency=10
```

En production, utiliser PM2 ou un service systemd pour maintenir le processus actif.

> ⚠️ **Le worker est une dépendance de production, pas un confort.** Depuis que
> les mails transactionnels passent par `SendMailJob`, un worker arrêté = aucun
> mail envoyé (invitations comprises) : les jobs s'accumulent en `pending` dans
> `queue_jobs` et repartent au redémarrage du worker. À superviser au même titre
> que le process HTTP.

Vérifications utiles :

```sql
-- Jobs en attente (worker arrêté ou saturé ?)
SELECT queue, status, count(*) FROM queue_jobs GROUP BY queue, status;

-- Dead-letter des mails : SELECT * FROM mail_deliveries WHERE status = 'failed'
-- (rejeu : node ace mail:retry --all-failed). Côté queue, mails en échec (30 jours). Le nom du job et sa
-- charge vivent dans la colonne `data` (JSON sérialisé), pas en colonnes.
SELECT id, error, data::jsonb -> 'payload' AS payload
FROM queue_jobs
WHERE status = 'failed' AND data::jsonb ->> 'name' = 'SendMailJob'
ORDER BY finished_at DESC;
```

## Supervision

Deux sondes (#61) :

- **`GET /health`** (process web) : 200 `{ "status": "ok" }` si la base répond, 503 sinon.
  Ne regarde pas la queue : un backlog ne doit pas faire redémarrer le web.
- **`node ace queue:health`** (worker) : affiche un rapport JSON et sort en 1 si
  - un job `pending` ou `delayed` a dépassé son échéance de plus de 15 min
    (worker absent ou saturé) ;
  - un job `active` est acquis depuis plus de 30 min (worker figé).

  Les échecs des 24 dernières heures sont affichés mais ne dégradent pas la sonde.
  Le healthcheck du service `worker` du compose l'exécute toutes les 60 s ; une
  alerte externe peut faire de même depuis un cron.

Seuils : `shared/types/health.ts` (`QUEUE_THRESHOLDS`).

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

- Le driver `sync` exécute les jobs immédiatement sans worker — c'est ce que
  positionnent `.env.test` et la CI (`QUEUE_DRIVER=sync`), ce qui rend les effets
  d'un job (mail envoyé…) directement assertables dans les tests.
  ⚠️ Il **rejoue les retries de façon synchrone, avec les vrais délais** : ne pas
  faire échouer un job à backoff long dans un test fonctionnel (tester le job
  directement, cf. `tests/unit/send_mail_job.spec.ts`).
- Le package est marqué **expérimental** : épingler la version dans `package.json`.
- Les jobs sont stockés dans la table `queue_jobs` ; inspecter cette table pour débugger.
