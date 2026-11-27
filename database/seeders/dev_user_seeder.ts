import Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'
import Role from '#models/role'
import AgencyProfile from '#models/agency_profile'
import SupplierProfile from '#models/supplier_profile'
import User from '#models/user'
import { DateTime } from 'luxon'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { demoPassword } from '#database/seed_password'

/**
 * Compte de démo **admin plateforme** (back-office `/admin`), sans organisation :
 * les comptes de démo fournisseur et agence restent des utilisateurs ordinaires.
 */
export const DEV_ADMIN_EMAIL = 'admin@promotionnal-sourcing.test'

/**
 * Compte de démo **fournisseur** : `owner` de l'organisation `eurogoods-org`
 * (celle qui porte la fiche catalogue `eurogoods` et ses produits).
 */
export const DEV_SUPPLIER_EMAIL = 'fournisseur@promotionnal-sourcing.test'

/**
 * Compte de démo **agence** (acheteur qui cherche des produits) : `owner` de
 * l'organisation acheteuse `promotionnal-sourcing`, dotée d'un profil d'agence.
 */
export const DEV_AGENCY_EMAIL = 'agence@promotionnal-sourcing.test'

export default class DevUserSeeder extends BaseSeeder {
  async run() {
    // Avant toute écriture : en production sans SEED_DEMO_PASSWORD, on échoue ici.
    const password = demoPassword()
    const ownerRole = await Role.findByOrFail('slug', 'owner')

    // Organisation acheteur (agence de démo)
    const buyerOrg = await Organization.updateOrCreate(
      { slug: 'promotionnal-sourcing' },
      {
        name: 'Promotionnal Sourcing',
        slug: 'promotionnal-sourcing',
        country: 'FR',
        organizationType: 'buyer',
      }
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

    // Mot de passe en clair : le modèle User (withAuthFinder) le hache déjà
    // via son hook @beforeSave — le hacher ici double-hacherait la valeur
    // stockée et rendrait la connexion impossible avec le mot de passe attendu.
    // `password` en local, SEED_DEMO_PASSWORD en production (staging).
    const supplierUser = await User.updateOrCreate(
      { email: DEV_SUPPLIER_EMAIL },
      {
        firstName: 'Sophie',
        lastName: 'Fournisseur',
        password,
        emailVerifiedAt: DateTime.now(),
      }
    )

    await OrganizationUser.updateOrCreate(
      { userId: supplierUser.id, organizationId: supplierOrg.id },
      { roleId: ownerRole.id }
    )

    await supplierUser.merge({ currentOrganizationId: supplierOrg.id }).save()

    const agencyUser = await User.updateOrCreate(
      { email: DEV_AGENCY_EMAIL },
      {
        firstName: 'Alex',
        lastName: 'Agence',
        password,
        emailVerifiedAt: DateTime.now(),
      }
    )

    const agencyOrg = buyerOrg

    await AgencyProfile.updateOrCreate(
      { organizationId: agencyOrg.id },
      {
        activity: 'object_communication_agency',
        teamSize: 'from_2_to_10',
        purchaseVolume: 'from_100k_to_500k',
        clientSectors: ['smes', 'key_accounts'],
      }
    )

    await OrganizationUser.updateOrCreate(
      { userId: agencyUser.id, organizationId: agencyOrg.id },
      { roleId: ownerRole.id }
    )

    await agencyUser.merge({ currentOrganizationId: agencyOrg.id }).save()

    const adminUser = await User.updateOrCreate(
      { email: DEV_ADMIN_EMAIL },
      {
        firstName: 'Admin',
        lastName: 'Plateforme',
        password,
        emailVerifiedAt: DateTime.now(),
        platformRole: 'admin',
      }
    )

    // L'admin plateforme administre les autres comptes : il n'appartient à aucune
    // organisation (ni fournisseur, ni agence). On retire donc les rattachements
    // laissés par un seed ou une inscription antérieurs sur une base existante.
    await OrganizationUser.query().where('userId', adminUser.id).delete()
    await adminUser.merge({ currentOrganizationId: null }).save()
  }
}
