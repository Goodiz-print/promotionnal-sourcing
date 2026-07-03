import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Supplier from '#models/supplier'

export default class SupplierSeeder extends BaseSeeder {
  async run() {
    await Supplier.updateOrCreateMany('slug', [
      {
        name: 'EuroGoods',
        slug: 'eurogoods',
        country: 'FR',
        website: 'https://eurogoods.example',
        description: "Fournisseur francais d'objets publicitaires",
        isActive: true,
      },
      {
        name: 'Nordic Promo',
        slug: 'nordic-promo',
        country: 'SE',
        website: 'https://nordicpromo.example',
        description: 'Goodies scandinaves eco-concus',
        isActive: true,
      },
      {
        name: 'Iberia Gifts',
        slug: 'iberia-gifts',
        country: 'ES',
        website: 'https://iberiagifts.example',
        description: "Cadeaux d'affaires fabriques en Espagne",
        isActive: true,
      },
    ])
  }
}
