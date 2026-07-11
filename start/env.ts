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

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),

  // Database
  // Connexion active : par defaut `pg` (et `sqlite` disponible pour les
  // tests legers). Le catalogue (pgvector/tsvector) impose Postgres.
  DB_CONNECTION: Env.schema.enum.optional(['pg', 'sqlite'] as const),
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string(),
  DB_DATABASE: Env.schema.string(),

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

  /*
  |----------------------------------------------------------
  | Cloudinary (upload et hébergement des images)
  |----------------------------------------------------------
  */
  CLOUDINARY_CLOUD_NAME: Env.schema.string(),
  CLOUDINARY_API_KEY: Env.schema.string(),
  CLOUDINARY_API_SECRET: Env.schema.string(),

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
  // Driver OpenAI-compatible (générique)
  AI_BASE_URL: Env.schema.string.optional(),
  AI_API_KEY: Env.schema.string.optional(),
  AI_EMBED_MODEL: Env.schema.string.optional(),
})
