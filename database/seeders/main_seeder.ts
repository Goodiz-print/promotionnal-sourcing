import { BaseSeeder } from '@adonisjs/lucid/seeders'

/**
 * Référentiel + données de **démo** (dev, tests, staging). Jamais en production :
 * la prod ne reçoit que `ReferenceSeeder` (docs/deploiement.md).
 */
export default class MainSeeder extends BaseSeeder {
  private async seed(Seeder: { default: typeof BaseSeeder }) {
    await new Seeder.default(this.client).run()
  }

  async run() {
    // Catégories de démo en premier, comme avant la séparation du référentiel :
    // elles ne dépendent de rien, et des specs prennent la première catégorie
    // créée (`Category.firstOrFail()`) en supposant qu'elle n'a aucun attribut.
    await this.seed(await import('./demo_category_seeder.js'))
    await this.seed(await import('./reference_seeder.js'))

    // Démo : comptes -> fournisseurs -> produits (qui référencent le
    // référentiel : labels, techniques, attributs).
    await this.seed(await import('./dev_user_seeder.js'))
    await this.seed(await import('./supplier_seeder.js'))
    await this.seed(await import('./product_seeder.js'))
  }
}
