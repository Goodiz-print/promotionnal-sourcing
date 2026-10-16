import env from '#start/env'

/**
 * Stockage objet Cellar (Clever Cloud, API S3). `CELLAR_ENDPOINT` peut être un
 * hôte nu (`CELLAR_ADDON_HOST` de Clever Cloud) ou une URL complète.
 *
 * Convention de clé imposée : `promotionnal-sourcing/<NODE_ENV>/<sha256>.<ext>`
 * — isole les objets par environnement.
 */
const endpoint = env.get('CELLAR_ENDPOINT')

const storageConfig = {
  endpoint: /^https?:\/\//.test(endpoint) ? endpoint : `https://${endpoint}`,
  bucket: env.get('CELLAR_BUCKET'),
  accessKeyId: env.get('CELLAR_ACCESS_KEY_ID'),
  secretAccessKey: env.get('CELLAR_SECRET_ACCESS_KEY').release(),
  // Cellar ignore la région mais le SDK en exige une.
  region: 'us-east-1',
  keyPrefix: `promotionnal-sourcing/${env.get('NODE_ENV')}`,
}

export default storageConfig
