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
     * `embedding` (vector, futur job d'embeddings Mistral) : colonne SQL brute
     * non typable par l'ORM et jamais exposee => exclue du schema genere.
     */
    products: {
      skipColumns: ['embedding'],
    },

    /**
     * `search_vector` (tsvector par langue, colonne generee) : idem, exclue.
     */
    product_translations: {
      skipColumns: ['search_vector'],
    },

    /**
     * `transports` (text[]) : liste WebAuthn (`usb`, `internal`, `hybrid`…), typée
     * pour éviter un `any` dans le service.
     */
    passkeys: {
      columns: {
        transports: { tsType: 'string[]' },
      },
    },
  },
} satisfies SchemaRules
