import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class MainSeeder extends BaseSeeder {
  private async seed(Seeder: { default: typeof BaseSeeder }) {
    await new Seeder.default(this.client).run()
  }

  async run() {
    await this.seed(await import('./role_seeder.js'))
    await this.seed(await import('./permission_seeder.js'))
    await this.seed(await import('./role_permission_seeder.js'))
    await this.seed(await import('./dev_user_seeder.js'))

    // Catalogue : fournisseurs -> categories -> attributs/valeurs ->
    // rattachement catégorie↔attribut (+ tranches) -> produits
    await this.seed(await import('./supplier_seeder.js'))
    await this.seed(await import('./category_seeder.js'))
    await this.seed(await import('./attribute_seeder.js'))
    await this.seed(await import('./category_attribute_seeder.js'))
    // Labels de conformité (écart 4) : avant les produits qui les référencent.
    await this.seed(await import('./certification_seeder.js'))
    await this.seed(await import('./product_seeder.js'))
  }
}
