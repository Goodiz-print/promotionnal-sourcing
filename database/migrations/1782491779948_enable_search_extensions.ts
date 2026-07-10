import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    if (this.db.dialect.name !== 'postgres') return

    // pgvector : stockage et recherche par similarite des embeddings produits
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS vector')
    // pg_trgm : recherche floue / similarite trigramme (typos)
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    // unaccent : normalisation des accents au moment de la requete (FR)
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS unaccent')
  }

  async down() {
    if (this.db.dialect.name !== 'postgres') return

    this.schema.raw('DROP EXTENSION IF EXISTS unaccent')
    this.schema.raw('DROP EXTENSION IF EXISTS pg_trgm')
    this.schema.raw('DROP EXTENSION IF EXISTS vector')
  }
}
