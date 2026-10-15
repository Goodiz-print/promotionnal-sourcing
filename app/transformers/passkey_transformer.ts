import { BaseTransformer } from '@adonisjs/core/transformers'
import type Passkey from '#models/passkey'
import type { PasskeyType } from '#shared/types/passkey'

/** Passkey → page « mon compte » : jamais la clé publique ni l'identifiant WebAuthn. */
export default class PasskeyTransformer extends BaseTransformer<Passkey> {
  toObject(): PasskeyType {
    return {
      ...this.pick(this.resource, ['id', 'name', 'backedUp']),
      deviceType: this.resource.deviceType as PasskeyType['deviceType'],
      createdAt: this.resource.createdAt.toISO()!,
      lastUsedAt: this.resource.lastUsedAt?.toISO() ?? null,
    }
  }
}
