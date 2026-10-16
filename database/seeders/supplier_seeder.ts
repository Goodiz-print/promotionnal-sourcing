import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Organization from '#models/organization'
import Supplier from '#models/supplier'
import SupplierTranslation from '#models/supplier_translation'
import type { ContentLocale } from '#shared/types/i18n'

type Text = { name: string; description: string }

type SupplierSeed = {
  slug: string
  country: string
  website: string
  translations: Record<ContentLocale, Text>
}

const SUPPLIERS: SupplierSeed[] = [
  {
    slug: 'eurogoods',
    country: 'FR',
    website: 'https://eurogoods.example',
    translations: {
      fr: { name: 'EuroGoods', description: "Fournisseur francais d'objets publicitaires" },
      en: { name: 'EuroGoods', description: 'French promotional products supplier' },
    },
  },
  {
    slug: 'nordic-promo',
    country: 'SE',
    website: 'https://nordicpromo.example',
    translations: {
      fr: { name: 'Nordic Promo', description: 'Goodies scandinaves eco-concus' },
      en: { name: 'Nordic Promo', description: 'Eco-designed Scandinavian goodies' },
    },
  },
  {
    slug: 'iberia-gifts',
    country: 'ES',
    website: 'https://iberiagifts.example',
    translations: {
      fr: { name: 'Iberia Gifts', description: "Cadeaux d'affaires fabriques en Espagne" },
      en: { name: 'Iberia Gifts', description: 'Corporate gifts made in Spain' },
    },
  },
]

export default class SupplierSeeder extends BaseSeeder {
  async run() {
    // Organisation fournisseur créée par DevUserSeeder : la fiche catalogue
    // `eurogoods` lui est rattachée (réconciliation suppliers ↔ organizations).
    const supplierOrg = await Organization.findBy('slug', 'eurogoods-org')

    for (const seed of SUPPLIERS) {
      const supplier = await Supplier.updateOrCreate(
        { slug: seed.slug },
        {
          country: seed.country,
          website: seed.website,
          isActive: true,
          organizationId: seed.slug === 'eurogoods' ? (supplierOrg?.id ?? null) : null,
        }
      )

      for (const locale of Object.keys(seed.translations) as ContentLocale[]) {
        await SupplierTranslation.updateOrCreate(
          { supplierId: supplier.id, locale },
          seed.translations[locale]
        )
      }
    }
  }
}
