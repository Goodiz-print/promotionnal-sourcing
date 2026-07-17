import vine from '@vinejs/vine'

export const inviteMemberValidator = vine.create({
  email: vine.string().email().maxLength(254).trim(),
  roleId: vine.number().positive(),
})
