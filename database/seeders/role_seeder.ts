import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Role from '#models/role'

export default class RoleSeeder extends BaseSeeder {
  async run() {
    await Role.updateOrCreateMany('slug', [
      {
        name: 'Proprietaire',
        slug: 'owner',
        description: "Acces complet a l'organisation et a la facturation",
      },
      {
        name: 'Administrateur',
        slug: 'admin',
        description: "Gestion de l'organisation et des membres sans acces facturation",
      },
      {
        name: 'Responsable',
        slug: 'manager',
        description: 'Gestion des sourcing et invitation de membres',
      },
      {
        name: 'Membre',
        slug: 'member',
        description: 'Acces en consultation et creation de demandes',
      },
    ])
  }
}
