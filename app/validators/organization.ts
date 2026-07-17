import vine from '@vinejs/vine'

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const createOrganizationValidator = vine.create({
  name: vine.string().minLength(2).maxLength(255).trim(),
  slug: vine
    .string()
    .maxLength(255)
    .regex(slugRegex)
    .unique({ table: 'organizations', column: 'slug' }),
  siret: vine
    .string()
    .regex(/^\d{14}$/)
    .optional()
    .nullable(),
  vatNumber: vine.string().maxLength(30).optional().nullable(),
  email: vine.string().email().maxLength(254).optional().nullable(),
  phone: vine.string().maxLength(30).optional().nullable(),
  website: vine.string().url().maxLength(500).optional().nullable(),
  industry: vine.string().maxLength(100).optional().nullable(),
  size: vine
    .enum(['micro', 'small', 'medium', 'large', 'enterprise'] as const)
    .optional()
    .nullable(),
  description: vine.string().maxLength(2000).optional().nullable(),
  logoUrl: vine.string().url().maxLength(500).optional().nullable(),
  addressLine1: vine.string().maxLength(255).optional().nullable(),
  addressLine2: vine.string().maxLength(255).optional().nullable(),
  city: vine.string().maxLength(100).optional().nullable(),
  postalCode: vine
    .string()
    .regex(/^\d{5}$/)
    .optional()
    .nullable(),
  country: vine.string().maxLength(2).optional(),
})

export const updateOrganizationValidator = vine.create({
  name: vine.string().minLength(2).maxLength(255).trim().optional(),
  siret: vine
    .string()
    .regex(/^\d{14}$/)
    .optional()
    .nullable(),
  vatNumber: vine.string().maxLength(30).optional().nullable(),
  email: vine.string().email().maxLength(254).optional().nullable(),
  phone: vine.string().maxLength(30).optional().nullable(),
  website: vine.string().url().maxLength(500).optional().nullable(),
  industry: vine.string().maxLength(100).optional().nullable(),
  size: vine
    .enum(['micro', 'small', 'medium', 'large', 'enterprise'] as const)
    .optional()
    .nullable(),
  description: vine.string().maxLength(2000).optional().nullable(),
  addressLine1: vine.string().maxLength(255).optional().nullable(),
  addressLine2: vine.string().maxLength(255).optional().nullable(),
  city: vine.string().maxLength(100).optional().nullable(),
  postalCode: vine
    .string()
    .regex(/^\d{5}$/)
    .optional()
    .nullable(),
  country: vine.string().maxLength(2).optional(),
  // Upload direct du logo (remplace un champ URL saisi) : géré par
  // OrganizationService/CloudinaryService, pas une valeur texte.
  logo: vine.file({ size: '2mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] }).optional(),
  // Supprime le logo courant sans en uploader un nouveau (checkbox dédiée).
  removeLogo: vine.boolean().optional(),
})
