import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Organization from '#models/organization'
import Supplier from '#models/supplier'
import SupplierTranslation from '#models/supplier_translation'
import type { SeedLocale } from '#database/seed_locale'

type Text = { name: string; description: string }

type SupplierSeed = {
  slug: string
  country: string
  website: string
  /** Organisation fournisseur de la fiche (#240 : sans organisation, rien n'est publié). */
  organizationSlug: string
  translations: Record<SeedLocale, Text>
}

const SUPPLIERS: SupplierSeed[] = [
  {
    slug: 'eurogoods',
    country: 'FR',
    website: 'https://eurogoods.example',
    organizationSlug: 'eurogoods-org',
    translations: {
      fr: { name: 'EuroGoods', description: "Fournisseur francais d'objets publicitaires" },
      en: { name: 'EuroGoods', description: 'French promotional products supplier' },
    },
  },
  {
    slug: 'nordic-promo',
    country: 'SE',
    website: 'https://nordicpromo.example',
    organizationSlug: 'nordic-promo-org',
    translations: {
      fr: { name: 'Nordic Promo', description: 'Goodies scandinaves eco-concus' },
      en: { name: 'Nordic Promo', description: 'Eco-designed Scandinavian goodies' },
    },
  },
  {
    slug: 'iberia-gifts',
    country: 'ES',
    website: 'https://iberiagifts.example',
    organizationSlug: 'iberia-gifts-org',
    translations: {
      fr: { name: 'Iberia Gifts', description: "Cadeaux d'affaires fabriques en Espagne" },
      en: { name: 'Iberia Gifts', description: 'Corporate gifts made in Spain' },
    },
  },
]

export default class SupplierSeeder extends BaseSeeder {
  async run() {
    for (const seed of SUPPLIERS) {
      const organization = await this.organizationFor(seed)
      const supplier = await Supplier.updateOrCreate(
        { slug: seed.slug },
        {
          country: seed.country,
          website: seed.website,
          isActive: true,
          organizationId: organization.id,
        }
      )

      for (const locale of Object.keys(seed.translations) as SeedLocale[]) {
        await SupplierTranslation.updateOrCreate(
          { supplierId: supplier.id, locale },
          seed.translations[locale]
        )
      }
    }
  }

  /**
   * Organisation fournisseur de la fiche : `eurogoods-org` est créée (avec ses
   * membres) par DevUserSeeder ; les autres le sont ici, sans membre. Une fiche
   * n'est publiée que rattachée à une organisation (#240).
   */
  private organizationFor(seed: SupplierSeed): Promise<Organization> {
    return Organization.firstOrCreate(
      { slug: seed.organizationSlug },
      {
        name: seed.translations.fr.name,
        slug: seed.organizationSlug,
        country: seed.country,
        organizationType: 'supplier',
      }
    )
  }
}
