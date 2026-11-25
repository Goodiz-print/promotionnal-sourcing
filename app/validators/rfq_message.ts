import vine from '@vinejs/vine'
import { MESSAGE_MAX_LENGTH } from '#shared/types/conversation'

/** Message écrit dans le fil d'une demande, depuis l'un ou l'autre côté (#226). */
export const rfqMessageValidator = vine.create({
  body: vine.string().trim().minLength(1).maxLength(MESSAGE_MAX_LENGTH),
})
