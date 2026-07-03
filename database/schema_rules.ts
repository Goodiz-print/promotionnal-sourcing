import { type SchemaRules } from '@adonisjs/lucid/types/schema_generator'

export default {
  /**
   * Colonnes globales : `password` ne doit jamais etre serialise vers le
   * frontend. L'introspection DB ne peut pas deviner `serializeAs: null`,
   * on le force donc ici pour que la regeneration du schema le preserve.
   */
  columns: {
    password: {
      tsType: 'string',
      decorators: [{ name: '@column', args: { serializeAs: null } }],
    },
  },

  tables: {
    /**
     * `embedding` (vector) et `search_vector` (tsvector) sont des colonnes
     * gerees en SQL brut (colonne generee pour le tsvector, futur job
     * d'embeddings Mistral pour le vecteur). Elles ne sont pas typables par
     * l'ORM et ne doivent jamais etre exposees : on les exclut du schema
     * genere.
     */
    products: {
      skipColumns: ['embedding', 'search_vector'],
    },
  },
} satisfies SchemaRules
