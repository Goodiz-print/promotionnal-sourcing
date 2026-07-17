import vine from '@vinejs/vine'

export const updateMemberRoleValidator = vine.create({
  roleId: vine.number().positive(),
})
