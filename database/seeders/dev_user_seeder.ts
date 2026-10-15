import Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'
import Role from '#models/role'
import SupplierProfile from '#models/supplier_profile'
import User from '#models/user'
import { DateTime } from 'luxon'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

/**
 * Compte de démo, également utilisé par les tests semés en `full`
 * (cf. `tests/utils/organizations.ts`).
 */
export const DEV_USER_EMAIL = 'malolebrin@gmail.com'

export default class DevUserSeeder extends BaseSeeder {
  async run() {
    const ownerRole = await Role.findByOrFail('slug', 'owner')

    // Mot de passe en clair : le modèle User (withAuthFinder) le hache déjà
    // via son hook @beforeSave — le hacher ici double-hacherait la valeur
    // stockée et rendrait la connexion impossible avec le mot de passe attendu.
    const user = await User.updateOrCreate(
      { email: DEV_USER_EMAIL },
      {
        fullName: 'Malo Lebrin',
        password: 'password',
        emailVerifiedAt: DateTime.now(),
      }
    )

    // Organisation acheteur (org courante du dev user)
    const buyerOrg = await Organization.updateOrCreate(
      { slug: 'promotionnal-sourcing' },
      {
        name: 'Promotionnal Sourcing',
        slug: 'promotionnal-sourcing',
        country: 'FR',
        organizationType: 'buyer',
      }
    )

    await OrganizationUser.updateOrCreate(
      { userId: user.id, organizationId: buyerOrg.id },
      { roleId: ownerRole.id }
    )

    // Organisation fournisseur : porte la fiche catalogue `eurogoods`
    // (rattachée dans SupplierSeeder) et un profil fournisseur détaillé.
    const supplierOrg = await Organization.updateOrCreate(
      { slug: 'eurogoods-org' },
      {
        name: 'EuroGoods',
        slug: 'eurogoods-org',
        country: 'FR',
        organizationType: 'supplier',
      }
    )

    await OrganizationUser.updateOrCreate(
      { userId: user.id, organizationId: supplierOrg.id },
      { roleId: ownerRole.id }
    )

    await SupplierProfile.updateOrCreate(
      { organizationId: supplierOrg.id },
      {
        minOrderQuantity: 50,
        deliveryDays: 10,
        deliveryScope: 'europe',
        certifications: ['ISO 9001', 'FSC'],
        bio: "Fournisseur francais d'objets publicitaires, spécialisé Made in Europe.",
        responseTimeDays: 2,
      }
    )

    await user.merge({ currentOrganizationId: buyerOrg.id }).save()
  }
}
