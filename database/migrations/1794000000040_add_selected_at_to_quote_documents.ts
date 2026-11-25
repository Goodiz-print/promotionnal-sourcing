import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Devis PDF « retenu » par l'agence (#228) : `quote_documents.selected_at`
 * marque le devis choisi, la demande étant clôturée dans la même transaction
 * (`QuoteService#selectDocument`). Aucune commande n'en découle : la suite se
 * fait entre l'agence et le fournisseur, hors plateforme.
 */
export default class extends BaseSchema {
  protected tableName = 'quote_documents'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('selected_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('selected_at')
    })
  }
}
