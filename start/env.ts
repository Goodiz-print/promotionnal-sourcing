/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'
import { TRANSMIT_TRANSPORTS } from '#shared/types/realtime'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),

  // Database
  // PostgreSQL est le seul moteur supporté (schéma dépendant de pgvector,
  // tsvector et des colonnes générées) : il n'y a plus de variable de
  // sélection de connexion, cf. `config/database.ts`.
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string(),
  DB_DATABASE: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Temps réel (Transmit)
  |----------------------------------------------------------
  | `memory` (défaut) : une seule instance web. `postgres` : transport partagé
  | par LISTEN/NOTIFY, obligatoire dès qu'il y a plusieurs instances web.
  */
  TRANSMIT_TRANSPORT: Env.schema.enum.optional(TRANSMIT_TRANSPORTS),

  // Session
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory', 'database'] as const),

  /*
  |----------------------------------------------------------
  | Variables for configuring @adonisjs/queue
  |----------------------------------------------------------
  */
  QUEUE_DRIVER: Env.schema.enum(['redis', 'database', 'sync'] as const),

  /*
  |----------------------------------------------------------
  | Variables for configuring @adonisjs/mail
  |----------------------------------------------------------
  */
  SMTP_HOST: Env.schema.string({ format: 'host' }),
  SMTP_PORT: Env.schema.number(),
  SMTP_SECURE: Env.schema.boolean(),
  SMTP_USERNAME: Env.schema.string.optional(),
  SMTP_PASSWORD: Env.schema.string.optional(),
  MAIL_FROM_ADDRESS: Env.schema.string(),
  MAIL_FROM_NAME: Env.schema.string(),
  MAIL_ALERT_ADDRESS: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Supervision de la plateforme (#179) — tout est optionnel
  |----------------------------------------------------------
  */
  HEALTH_TOKEN: Env.schema.string.optional(),
  // Commit de l'image, posé au build (Dockerfile) et annoncé par GET /health.
  APP_VERSION: Env.schema.string.optional(),
  HEALTH_PROBE_TIMEOUT_MS: Env.schema.number.optional(),
  HEALTH_SLOW_MS: Env.schema.number.optional(),
  HEALTH_MAIL_FAILED_THRESHOLD: Env.schema.number.optional(),
  HEALTH_ALERT_AFTER_FAILURES: Env.schema.number.optional(),

  /*
  |----------------------------------------------------------
  | Cellar (Clever Cloud, API S3) — stockage des fichiers
  |----------------------------------------------------------
  */
  CELLAR_ENDPOINT: Env.schema.string(),
  CELLAR_BUCKET: Env.schema.string(),
  CELLAR_ACCESS_KEY_ID: Env.schema.string(),
  CELLAR_SECRET_ACCESS_KEY: Env.schema.secret(),

  /*
  |----------------------------------------------------------
  | Meilisearch — moteur de recherche hybride (#112)
  |----------------------------------------------------------
  | Optionnelles : sans `MEILISEARCH_HOST`, l'indexation est désactivée (dev,
  | test, CI) et PostgreSQL reste le seul moteur. `MEILISEARCH_API_KEY` doit
  | autoriser l'écriture dans l'index (clé master ou clé dédiée).
  */
  MEILISEARCH_HOST: Env.schema.string.optional(),
  MEILISEARCH_API_KEY: Env.schema.string.optional(),
  // Poids du sémantique dans la recherche hybride, de 0 à 1 (défaut 0,5).
  SEARCH_SEMANTIC_RATIO: Env.schema.number.optional(),

  /*
  |----------------------------------------------------------
  | IA — embeddings produits (recherche sémantique)
  |----------------------------------------------------------
  | Provider-agnostique : `AI_PROVIDER` choisit le driver
  | (`mistral` | `openai-compatible`). Toutes optionnelles :
  | la génération est désactivée par défaut (AI_EMBEDDINGS_ENABLED).
  */
  AI_PROVIDER: Env.schema.string.optional(),
  AI_EMBEDDINGS_ENABLED: Env.schema.boolean.optional(),
  // Driver Mistral (natif)
  MISTRAL_API_KEY: Env.schema.string.optional(),
  MISTRAL_EMBED_MODEL: Env.schema.string.optional(),
  AI_TRANSLATION_ENABLED: Env.schema.boolean.optional(),
  MISTRAL_TRANSLATION_MODEL: Env.schema.string.optional(),
  // Tarif de la traduction (par million de tokens) : sert à estimer le coût dans le back-office
  AI_PRICE_INPUT_PER_MILLION: Env.schema.number.optional(),
  AI_PRICE_OUTPUT_PER_MILLION: Env.schema.number.optional(),
  AI_PRICE_CURRENCY: Env.schema.string.optional(),
  // Recherche par image (modèle vision Mistral)
  AI_VISION_ENABLED: Env.schema.boolean.optional(),
  MISTRAL_VISION_MODEL: Env.schema.string.optional(),
  // Driver Claude (API Anthropic). Sa clé présente, Claude sert à la traduction et à la
  // recherche par image ; sinon Mistral (`MISTRAL_API_KEY`). Sans effet sur les embeddings.
  ANTHROPIC_API_KEY: Env.schema.string.optional(),
  CLAUDE_TRANSLATION_MODEL: Env.schema.string.optional(),
  CLAUDE_VISION_MODEL: Env.schema.string.optional(),
  // Driver OpenAI-compatible (générique)
  AI_BASE_URL: Env.schema.string.optional(),
  AI_API_KEY: Env.schema.string.optional(),
  AI_EMBED_MODEL: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Produits sponsorisés — recharge du portefeuille (Stripe)
  |----------------------------------------------------------
  | Optionnelles : sans `STRIPE_SECRET_KEY`, la recharge en ligne est
  | désactivée (l'équipe crédite les portefeuilles depuis le back-office).
  | `STRIPE_WEBHOOK_SECRET` signe les notifications de paiement.
  */
  STRIPE_SECRET_KEY: Env.schema.secret.optional(),
  STRIPE_WEBHOOK_SECRET: Env.schema.secret.optional(),

  /*
  |----------------------------------------------------------
  | Abonnements fournisseurs — souscription en ligne (Stripe)
  |----------------------------------------------------------
  | Identifiants des prix récurrents mensuels (`price_…`). Optionnels : sans
  | eux (ou sans `STRIPE_SECRET_KEY`), la souscription en ligne est désactivée.
  */
  STRIPE_PRICE_BUSINESS: Env.schema.string.optional(),
  STRIPE_PRICE_PREMIUM: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Réception des mails entrants (réponses des fournisseurs, ADR 0005)
  |----------------------------------------------------------
  | Toutes optionnelles : sans prestataire, domaine relais et clés, la
  | réception est désactivée et les mails de demande partent sans `Reply-To`.
  | `INBOUND_MAIL_SIGNING_KEY` vérifie la signature du webhook,
  | `INBOUND_MAIL_API_KEY` lit le contenu des mails (web **et** worker).
  */
  INBOUND_MAIL_PROVIDER: Env.schema.enum.optional(['resend', 'none'] as const),
  INBOUND_MAIL_DOMAIN: Env.schema.string.optional({ format: 'host' }),
  INBOUND_MAIL_SIGNING_KEY: Env.schema.secret.optional(),
  INBOUND_MAIL_API_KEY: Env.schema.secret.optional(),
  INBOUND_MAIL_MAX_SIZE_MB: Env.schema.number.optional(),
  INBOUND_MAIL_MAX_ATTACHMENT_SIZE_MB: Env.schema.number.optional(),
  INBOUND_MAIL_GRACE_DAYS: Env.schema.number.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the limiter package
  |----------------------------------------------------------
  */
  LIMITER_STORE: Env.schema.enum(['database', 'memory'] as const),

  /*
  |----------------------------------------------------------
  | Variables for configuring passkeys (WebAuthn)
  |----------------------------------------------------------
  | Par défaut dérivées de APP_URL (domaine et origine de l'application) ;
  | à surcharger seulement si le site est servi derrière un autre domaine.
  */
  PASSKEY_RP_ID: Env.schema.string.optional(),
  PASSKEY_ORIGIN: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Connecteurs de flux fournisseurs (`node ace supplier:import`)
  |----------------------------------------------------------
  | Accès RÉELS aux catalogues (prix nets du compte) : uniquement dans `.env`,
  | jamais committés. Tous optionnels : un connecteur sans sa variable lève une
  | erreur explicite à l'usage, sans empêcher l'application de démarrer.
  | `PFCONCEPT_FEED_CODE` est le code distributeur présent dans les URLs des
  | flux prix / stock / prix de marquage PF Concept.
  */
  PFCONCEPT_FEED_CODE: Env.schema.secret.optional(),
  PASSOT_API_KEY: Env.schema.secret.optional(),
  INSPIRION_API_KEY: Env.schema.secret.optional(),
  MAKITO_EMAIL: Env.schema.string.optional(),
  MAKITO_PASSWORD: Env.schema.secret.optional(),
  SUPPLIER_FEED_TIMEOUT_MS: Env.schema.number.optional(),
  SUPPLIER_FEED_USER_AGENT: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Données de démo et de test (seeders, docs/deploiement.md)
  |----------------------------------------------------------
  | `SEED_DEMO_PASSWORD` : mot de passe commun des comptes de démo et de test,
  | obligatoire (12 caractères min.) pour seeder en production, donc sur le
  | staging. `SEED_ADMIN_EMAILS` : admins nominatifs du staging, séparés par des
  | virgules ; sans elle, `StagingAccountSeeder` ne fait rien.
  */
  SEED_DEMO_PASSWORD: Env.schema.secret.optional(),
  SEED_ADMIN_EMAILS: Env.schema.string.optional(),
})
