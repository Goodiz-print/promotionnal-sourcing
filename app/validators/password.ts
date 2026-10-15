import vine from '@vinejs/vine'

export const forgotPasswordValidator = vine.create({
  email: vine.string().email().maxLength(254),
})

export const resetPasswordValidator = vine.create({
  password: vine
    .string()
    .minLength(8)
    .maxLength(32)
    .confirmed({ confirmationField: 'passwordConfirmation' }),
})
