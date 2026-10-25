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
     * `address_line1` / `address_line2` : la stratégie de nommage de Lucid
     * déduirait `address_line_1` de `addressLine1` (le chiffre s'accole au mot en
     * base). Sans `columnName` explicite, ces deux champs ne se lisent ni ne
     * s'écrivent jamais.
     */
    organizations: {
      columns: {
        address_line1: {
          tsType: 'string',
          decorators: [{ name: '@column', args: { columnName: 'address_line1' } }],
        },
        address_line2: {
          tsType: 'string',
          decorators: [{ name: '@column', args: { columnName: 'address_line2' } }],
        },
      },
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
