import vine from '@vinejs/vine'

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const createProductValidator = vine.create({
  supplierId: vine.number().positive(),
  categoryId: vine.number().positive(),
  name: vine.string().minLength(2).maxLength(255).trim(),
  slug: vine.string().maxLength(255).regex(slugRegex).unique({ table: 'products', column: 'slug' }),
  reference: vine.string().maxLength(100).optional().nullable(),
  description: vine.string().maxLength(5000).optional().nullable(),
  priceMin: vine.number().positive().optional().nullable(),
  priceMax: vine.number().positive().optional().nullable(),
  currency: vine.string().maxLength(3).optional(),
  minQuantity: vine.number().positive().optional().nullable(),
  imageUrl: vine.string().url().maxLength(500).optional().nullable(),
  originCountry: vine.string().maxLength(2).optional().nullable(),
  madeInEurope: vine.boolean().optional(),
  isActive: vine.boolean().optional(),
})

export const updateProductValidator = vine.create({
  supplierId: vine.number().positive().optional(),
  categoryId: vine.number().positive().optional(),
  name: vine.string().minLength(2).maxLength(255).trim().optional(),
  reference: vine.string().maxLength(100).optional().nullable(),
  description: vine.string().maxLength(5000).optional().nullable(),
  priceMin: vine.number().positive().optional().nullable(),
  priceMax: vine.number().positive().optional().nullable(),
  currency: vine.string().maxLength(3).optional(),
  minQuantity: vine.number().positive().optional().nullable(),
  imageUrl: vine.string().url().maxLength(500).optional().nullable(),
  originCountry: vine.string().maxLength(2).optional().nullable(),
  madeInEurope: vine.boolean().optional(),
  isActive: vine.boolean().optional(),
})
