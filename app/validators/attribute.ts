import vine from '@vinejs/vine'

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const createAttributeValidator = vine.create({
  name: vine.string().minLength(2).maxLength(255).trim(),
  slug: vine
    .string()
    .maxLength(255)
    .regex(slugRegex)
    .unique({ table: 'attributes', column: 'slug' }),
  type: vine.enum(['string', 'number', 'boolean', 'enum'] as const).optional(),
  unit: vine.string().maxLength(30).optional().nullable(),
  isFilterable: vine.boolean().optional(),
})

export const updateAttributeValidator = vine.create({
  name: vine.string().minLength(2).maxLength(255).trim().optional(),
  type: vine.enum(['string', 'number', 'boolean', 'enum'] as const).optional(),
  unit: vine.string().maxLength(30).optional().nullable(),
  isFilterable: vine.boolean().optional(),
})

export const createAttributeValueValidator = vine.create({
  attributeId: vine.number().positive(),
  value: vine.string().maxLength(255).trim(),
  label: vine.string().maxLength(255).trim(),
  slug: vine.string().maxLength(255).regex(slugRegex),
  synonyms: vine.array(vine.string().maxLength(100)).optional(),
})

export const updateAttributeValueValidator = vine.create({
  value: vine.string().maxLength(255).trim().optional(),
  label: vine.string().maxLength(255).trim().optional(),
  slug: vine.string().maxLength(255).regex(slugRegex).optional(),
  synonyms: vine.array(vine.string().maxLength(100)).optional(),
})
