import env from '#start/env'

/**
 * Supervision de la plateforme (#179). Tous les seuils sont configurables : la
 * valeur par défaut convient à un site à faible trafic.
 */
const healthConfig = {
  /**
   * Jeton du point d'entrée détaillé `GET /health/details` (supervision externe).
   * Sans jeton, le point d'entrée n'existe pas (404) : jamais ouvert par défaut.
   */
  token: env.get('HEALTH_TOKEN'),

  /** Délai maximal d'une sonde : un service muet ne doit pas figer l'écran ni le job. */
  probeTimeoutMs: env.get('HEALTH_PROBE_TIMEOUT_MS', 3000),

  /** Une sonde qui répond plus lentement que cela rend le composant `degraded`. */
  slowMs: env.get('HEALTH_SLOW_MS', 1500),

  /** Échecs d'envoi de mails sur la dernière heure à partir desquels le mail est `degraded`. */
  mailFailedThreshold: env.get('HEALTH_MAIL_FAILED_THRESHOLD', 5),

  /** Passes consécutives hors `ok` avant d'alerter : un raté isolé ne réveille personne. */
  alertAfterFailures: env.get('HEALTH_ALERT_AFTER_FAILURES', 2),

  /** Destinataire des alertes (le même que celui des mails en échec) ; vide = log seul. */
  alertAddress: env.get('MAIL_ALERT_ADDRESS'),
}

export default healthConfig
