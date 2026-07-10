import vine from '@vinejs/vine'

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const createSupplierValidator = vine.create({
  name: vine.string().minLength(2).maxLength(255).trim(),
  slug: vine
    .string()
    .maxLength(255)
    .regex(slugRegex)
    .unique({ table: 'suppliers', column: 'slug' }),
  country: vine.string().maxLength(2).optional(),
  website: vine.string().url().maxLength(500).optional().nullable(),
  email: vine.string().email().maxLength(254).optional().nullable(),
  phone: vine.string().maxLength(30).optional().nullable(),
  description: vine.string().maxLength(2000).optional().nullable(),
  logoUrl: vine.string().url().maxLength(500).optional().nullable(),
  isActive: vine.boolean().optional(),
})

export const updateSupplierValidator = vine.create({
  name: vine.string().minLength(2).maxLength(255).trim().optional(),
  country: vine.string().maxLength(2).optional(),
  website: vine.string().url().maxLength(500).optional().nullable(),
  email: vine.string().email().maxLength(254).optional().nullable(),
  phone: vine.string().maxLength(30).optional().nullable(),
  description: vine.string().maxLength(2000).optional().nullable(),
  logoUrl: vine.string().url().maxLength(500).optional().nullable(),
  isActive: vine.boolean().optional(),
})
