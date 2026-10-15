import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { PasskeySchema } from '#database/schema'
import User from '#models/user'

export default class Passkey extends PasskeySchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
