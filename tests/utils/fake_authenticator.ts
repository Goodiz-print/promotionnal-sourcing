import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto'
import { isoBase64URL, isoCBOR } from '@simplewebauthn/server/helpers'
import passkeyConfig from '#config/passkey'
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server'

const FLAG_USER_PRESENT = 0x01
const FLAG_USER_VERIFIED = 0x04
const FLAG_ATTESTED_CREDENTIAL = 0x40

export interface CeremonyOptions {
  /** Défi renvoyé par le serveur (base64url). */
  challenge: string
  /** Origine déclarée par le « navigateur » ; celle de l'application par défaut. */
  origin?: string
  /** Compteur de signatures annoncé par l'authentificateur. */
  counter?: number
}

/**
 * Authentificateur WebAuthn factice (clé ES256, attestation `none`) : produit les
 * mêmes réponses qu'un navigateur, ce qui permet de tester les cérémonies de bout
 * en bout contre la vraie vérification de `@simplewebauthn/server`.
 */
export class FakeAuthenticator {
  readonly credentialId = isoBase64URL.fromBuffer(randomBytes(32))
  private readonly privateKey: KeyObject
  private readonly publicJwk: { x: string; y: string }

  constructor() {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    this.privateKey = privateKey
    const jwk = publicKey.export({ format: 'jwk' })
    this.publicJwk = { x: jwk.x!, y: jwk.y! }
  }

  register({ challenge, origin, counter = 0 }: CeremonyOptions): RegistrationResponseJSON {
    const credentialId = isoBase64URL.toBuffer(this.credentialId)
    const credentialIdLength = Buffer.alloc(2)
    credentialIdLength.writeUInt16BE(credentialId.length)

    const authData = Buffer.concat([
      this.authenticatorData(
        FLAG_USER_PRESENT | FLAG_USER_VERIFIED | FLAG_ATTESTED_CREDENTIAL,
        counter
      ),
      Buffer.alloc(16), // AAGUID
      credentialIdLength,
      credentialId,
      this.coseKey(),
    ])
    const attestationObject = isoCBOR.encode(
      new Map<string, unknown>([
        ['fmt', 'none'],
        ['attStmt', new Map()],
        ['authData', authData],
      ]) as never
    )

    return {
      id: this.credentialId,
      rawId: this.credentialId,
      type: 'public-key',
      clientExtensionResults: {},
      authenticatorAttachment: 'platform',
      response: {
        clientDataJSON: this.clientData('webauthn.create', challenge, origin),
        attestationObject: isoBase64URL.fromBuffer(attestationObject),
        transports: ['internal'],
      },
    }
  }

  authenticate({ challenge, origin, counter = 1 }: CeremonyOptions): AuthenticationResponseJSON {
    const clientDataJSON = this.clientData('webauthn.get', challenge, origin)
    const authData = this.authenticatorData(FLAG_USER_PRESENT | FLAG_USER_VERIFIED, counter)
    const clientDataHash = createHash('sha256')
      .update(isoBase64URL.toBuffer(clientDataJSON))
      .digest()
    const signature = sign('sha256', Buffer.concat([authData, clientDataHash]), this.privateKey)

    return {
      id: this.credentialId,
      rawId: this.credentialId,
      type: 'public-key',
      clientExtensionResults: {},
      authenticatorAttachment: 'platform',
      response: {
        clientDataJSON,
        authenticatorData: isoBase64URL.fromBuffer(new Uint8Array(authData)),
        signature: isoBase64URL.fromBuffer(new Uint8Array(signature)),
      },
    }
  }

  /** Clé publique COSE (base64url), telle que le serveur la stocke en base. */
  get publicKey(): string {
    return isoBase64URL.fromBuffer(new Uint8Array(this.coseKey()))
  }

  private coseKey(): Uint8Array {
    return isoCBOR.encode(
      new Map<number, number | Uint8Array>([
        [1, 2], // kty : EC2
        [3, -7], // alg : ES256
        [-1, 1], // crv : P-256
        [-2, isoBase64URL.toBuffer(this.publicJwk.x)],
        [-3, isoBase64URL.toBuffer(this.publicJwk.y)],
      ])
    )
  }

  private authenticatorData(flags: number, counter: number): Buffer {
    const counterBytes = Buffer.alloc(4)
    counterBytes.writeUInt32BE(counter)
    const rpIdHash = createHash('sha256').update(passkeyConfig.rpID).digest()
    return Buffer.concat([rpIdHash, Buffer.from([flags]), counterBytes])
  }

  private clientData(type: string, challenge: string, origin = passkeyConfig.origin): string {
    return isoBase64URL.fromBuffer(
      Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }))
    )
  }
}
