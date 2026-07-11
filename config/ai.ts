import env from '#start/env'

/**
 * Configuration IA (Mistral). Les embeddings produits alimentent la recherche
 * sémantique du catalogue (colonne `products.embedding`, pgvector — voir
 * `docs/catalogue.md`).
 *
 * `embeddings.enabled` gouverne la génération (job d'embedding produit + calcul
 * de l'embedding de la requête de recherche). **Désactivé par défaut**
 * (dev / test / CI) : l'API Mistral n'est appelée qu'en production, où l'on
 * pose `AI_EMBEDDINGS_ENABLED=true` et `MISTRAL_API_KEY`. Ainsi les tests ne
 * font aucun appel réseau.
 */
const aiConfig = {
  mistral: {
    apiKey: env.get('MISTRAL_API_KEY'),
    // `mistral-embed` produit des vecteurs de 1024 dimensions
    // (cf. colonne `products.embedding vector(1024)`).
    embedModel: 'mistral-embed',
    dimensions: 1024,
  },
  embeddings: {
    enabled: env.get('AI_EMBEDDINGS_ENABLED', false),
  },
}

export default aiConfig
