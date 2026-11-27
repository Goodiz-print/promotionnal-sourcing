import { BaseSeeder } from '@adonisjs/lucid/seeders'

/**
 * Référentiel de la plateforme, semé dans **tous** les environnements, prod
 * comprise : rôles et permissions (sans eux, aucune organisation ne peut être
 * créée), arbre de catégories, attributs, labels, techniques de marquage.
 * Aucun compte, aucune fiche, aucun produit.
 *
 * Lancé à chaque déploiement, après les migrations
 * (`scripts/deploy/clever_migrate.sh`) : idempotent (`updateOrCreate`) et
 * additif, donc compatible avec la version encore en place pendant la bascule.
 */
export default class ReferenceSeeder extends BaseSeeder {
  private async seed(Seeder: { default: typeof BaseSeeder }) {
    await new Seeder.default(this.client).run()
  }

  async run() {
    await this.seed(await import('./role_seeder.js'))
    await this.seed(await import('./permission_seeder.js'))
    await this.seed(await import('./role_permission_seeder.js'))

    // Catalogue : catégories -> attributs/valeurs -> rattachement
    // catégorie↔attribut (+ tranches) -> labels (écart 4) -> techniques (écart 2).
    await this.seed(await import('./category_seeder.js'))
    await this.seed(await import('./attribute_seeder.js'))
    await this.seed(await import('./category_attribute_seeder.js'))
    await this.seed(await import('./certification_seeder.js'))
    await this.seed(await import('./marking_technique_seeder.js'))
  }
}
