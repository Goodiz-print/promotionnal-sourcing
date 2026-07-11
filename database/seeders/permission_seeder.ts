import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Permission from '#models/permission'

export default class PermissionSeeder extends BaseSeeder {
  async run() {
    await Permission.updateOrCreateMany('slug', [
      {
        name: "Gerer l'organisation",
        slug: 'organization:manage',
        description: "Modifier les informations de l'organisation",
      },
      {
        name: 'Inviter des membres',
        slug: 'members:invite',
        description: "Envoyer des invitations a rejoindre l'organisation",
      },
      {
        name: 'Gerer les membres',
        slug: 'members:manage',
        description: 'Modifier ou retirer des membres',
      },
      {
        name: 'Attribuer des roles',
        slug: 'roles:assign',
        description: "Modifier le role d'un membre",
      },
      {
        name: 'Creer des sourcing',
        slug: 'sourcing:create',
        description: 'Soumettre de nouvelles demandes de sourcing',
      },
      {
        name: 'Gerer les sourcing',
        slug: 'sourcing:manage',
        description: 'Modifier et archiver les demandes de sourcing',
      },
      {
        name: 'Voir les sourcing',
        slug: 'sourcing:view',
        description: 'Consulter les demandes de sourcing',
      },
      {
        name: 'Gerer la facturation',
        slug: 'billing:manage',
        description: 'Acceder aux abonnements et factures',
      },
      {
        name: 'Gerer les categories',
        slug: 'categories:manage',
        description: 'Administrer la taxonomie du catalogue (categories)',
      },
    ])
  }
}
