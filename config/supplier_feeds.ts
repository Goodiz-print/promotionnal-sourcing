import env from '#start/env'

/**
 * Connecteurs de flux fournisseurs (`node ace supplier:import`). Les identifiants
 * sont des **accès réels** : uniquement dans `.env`, jamais committés, jamais
 * journalisés (les URLs sont masquées par `redactUrl`). Un connecteur sans ses
 * variables lève `SupplierConnectorNotConfiguredException` à l'usage, sans
 * empêcher l'application de démarrer.
 */
const supplierFeedsConfig = {
  http: {
    timeoutMs: env.get('SUPPLIER_FEED_TIMEOUT_MS') ?? 300_000,
    retries: 2,
    /** Durée de vie du cache disque des flux (`tmp/supplier_feeds/`, `--refresh` pour forcer). */
    cacheTtlMs: 12 * 60 * 60 * 1000,
    /**
     * User-Agent annoncé aux fournisseurs. Celui de Node par défaut est refusé
     * par certains pare-feu (Passot : HTTP 426) ; surcharger via
     * `SUPPLIER_FEED_USER_AGENT` si un fournisseur en liste un autre.
     */
    userAgent: env.get('SUPPLIER_FEED_USER_AGENT') ?? 'GoodizprintSourcing/1.0',
  },
  /** Images conservées par produit importé (galerie + images de variantes). */
  maxImagesPerProduct: 5,
  pfconcept: {
    baseUrl: 'https://www.pfconcept.com/portal/datafeed',
    imageBaseUrl: 'https://images.pfconcept.com/ProductImages_All/JPG/1600x1600/',
    /** Code distributeur des flux prix / stock / prix de marquage (secret). */
    feedCode: env.get('PFCONCEPT_FEED_CODE')?.release() ?? null,
    /** Département des données de marquage (France). */
    printDepartment: 'cfr1',
  },
  passot: {
    baseUrl: 'https://www.pidesign.eu',
    imageBaseUrl: 'https://media.pidesign.eu/media/catalog/product',
    apiKey: env.get('PASSOT_API_KEY')?.release() ?? null,
  },
  inspirion: {
    baseUrl: 'https://leoapi.inspirion.eu',
    apiKey: env.get('INSPIRION_API_KEY')?.release() ?? null,
  },
  makito: {
    baseUrl: 'https://data.makito.es/api',
    /** Identifiants du compte client : `POST /login` renvoie le jeton d'accès. */
    email: env.get('MAKITO_EMAIL') ?? null,
    password: env.get('MAKITO_PASSWORD')?.release() ?? null,
  },
}

export default supplierFeedsConfig
