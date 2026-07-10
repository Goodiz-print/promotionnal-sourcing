import vine from '@vinejs/vine'

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const createCategoryValidator = vine.create({
  name: vine.string().minLength(2).maxLength(255).trim(),
  slug: vine
    .string()
    .maxLength(255)
    .regex(slugRegex)
    .unique({ table: 'categories', column: 'slug' }),
  parentId: vine.number().positive().optional().nullable(),
  description: vine.string().maxLength(2000).optional().nullable(),
  synonyms: vine.array(vine.string().maxLength(100)).optional(),
})

export const updateCategoryValidator = vine.create({
  name: vine.string().minLength(2).maxLength(255).trim().optional(),
  parentId: vine.number().positive().optional().nullable(),
  description: vine.string().maxLength(2000).optional().nullable(),
  synonyms: vine.array(vine.string().maxLength(100)).optional(),
})
