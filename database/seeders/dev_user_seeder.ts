import Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'
import Role from '#models/role'
import SupplierProfile from '#models/supplier_profile'
import User from '#models/user'
import hash from '@adonisjs/core/services/hash'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class DevUserSeeder extends BaseSeeder {
  async run() {
    const ownerRole = await Role.findByOrFail('slug', 'owner')

    const user = await User.updateOrCreate(
      { email: 'malolebrin@gmail.com' },
      {
        fullName: 'Malo Lebrin',
        password: await hash.make('password'),
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
