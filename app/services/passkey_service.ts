import { inject } from '@adonisjs/core'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { isoBase64URL, isoUint8Array } from '@simplewebauthn/server/helpers'
import { DateTime } from 'luxon'
import passkeyConfig from '#config/passkey'
import Passkey from '#models/passkey'
import type User from '#models/user'
import {
  PasskeyAlreadyRegisteredException,
  PasskeyVerificationFailedException,
} from '#exceptions/passkey_errors'
import { PASSKEY_CHALLENGE_TTL_MS, type PasskeyChallenge } from '#shared/types/passkey'
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server'
import type { Session } from '@adonisjs/session'

const REGISTRATION_CHALLENGE_KEY = 'passkey.registration'
const AUTHENTICATION_CHALLENGE_KEY = 'passkey.authentication'

/**
 * Passkeys (WebAuthn) : enregistrement depuis « mon compte », connexion sans mot
 * de passe depuis l'écran de login.
 *
 * Le défi de chaque cérémonie vit dans la **session** (jamais en base) : il est à
 * usage unique — retiré dès qu'on tente de le vérifier — et expire après
 * `PASSKEY_CHALLENGE_TTL_MS`. La connexion utilise des identifiants
 * « découvrables » : aucun email à saisir, le compte est retrouvé via la passkey.
 */
@inject()
export default class PasskeyService {
  list(user: User): Promise<Passkey[]> {
    return Passkey.query().where('userId', user.id).orderBy('createdAt', 'asc')
  }

  async registrationOptions(
    user: User,
    session: Session
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const existing = await this.list(user)
    const options = await generateRegistrationOptions({
      rpName: passkeyConfig.rpName,
      rpID: passkeyConfig.rpID,
      userName: user.email,
      userDisplayName: user.fullName ?? user.email,
      // Identifiant stable du compte dans l'authentificateur : l'id interne, sans donnée personnelle.
      userID: isoUint8Array.fromUTF8String(String(user.id)),
      attestationType: 'none',
      // Empêche d'enregistrer deux fois le même authentificateur.
      excludeCredentials: existing.map((passkey) => ({
        id: passkey.credentialId,
        transports: passkey.transports ?? undefined,
      })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    })

    this.storeChallenge(session, REGISTRATION_CHALLENGE_KEY, options.challenge)
    return options
  }

  async register(
    user: User,
    session: Session,
    credentialJson: string,
    name: string
  ): Promise<Passkey> {
    const response = this.parse<RegistrationResponseJSON>(credentialJson)
    const challenge = this.takeChallenge(session, REGISTRATION_CHALLENGE_KEY)

    let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: passkeyConfig.origin,
        expectedRPID: passkeyConfig.rpID,
        requireUserVerification: false,
      })
    } catch {
      throw new PasskeyVerificationFailedException()
    }
    if (!verification.verified) throw new PasskeyVerificationFailedException()

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo
    if (await Passkey.findBy('credentialId', credential.id)) {
      throw new PasskeyAlreadyRegisteredException()
    }

    return Passkey.create({
      userId: user.id,
      credentialId: credential.id,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? null,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      name,
    })
  }

  async authenticationOptions(session: Session): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const options = await generateAuthenticationOptions({
      rpID: passkeyConfig.rpID,
      userVerification: 'preferred',
      // Vide : identifiants découvrables, le navigateur propose les passkeys du site.
      allowCredentials: [],
    })

    this.storeChallenge(session, AUTHENTICATION_CHALLENGE_KEY, options.challenge)
    return options
  }

  /** Vérifie la signature et retourne le propriétaire de la passkey. */
  async authenticate(session: Session, credentialJson: string): Promise<User> {
    const response = this.parse<AuthenticationResponseJSON>(credentialJson)
    const challenge = this.takeChallenge(session, AUTHENTICATION_CHALLENGE_KEY)

    const passkey = await Passkey.query()
      .where('credentialId', String(response.id))
      .preload('user')
      .first()
    if (!passkey) throw new PasskeyVerificationFailedException()

    let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: passkeyConfig.origin,
        expectedRPID: passkeyConfig.rpID,
        requireUserVerification: false,
        credential: {
          id: passkey.credentialId,
          publicKey: isoBase64URL.toBuffer(passkey.publicKey),
          // `bigint` en base : le driver le renvoie en chaîne.
          counter: Number(passkey.counter),
          transports: passkey.transports ?? undefined,
        },
      })
    } catch {
      throw new PasskeyVerificationFailedException()
    }
    if (!verification.verified) throw new PasskeyVerificationFailedException()

    passkey.merge({
      counter: verification.authenticationInfo.newCounter,
      backedUp: verification.authenticationInfo.credentialBackedUp,
      lastUsedAt: DateTime.now(),
    })
    await passkey.save()

    return passkey.user
  }

  async rename(user: User, id: number, name: string): Promise<void> {
    const passkey = await Passkey.query().where('userId', user.id).where('id', id).firstOrFail()
    passkey.name = name
    await passkey.save()
  }

  async remove(user: User, id: number): Promise<void> {
    const passkey = await Passkey.query().where('userId', user.id).where('id', id).firstOrFail()
    await passkey.delete()
  }

  private storeChallenge(session: Session, key: string, value: string): void {
    const challenge: PasskeyChallenge = { value, expiresAt: Date.now() + PASSKEY_CHALLENGE_TTL_MS }
    session.put(key, challenge)
  }

  /** Défi à usage unique : retiré de la session même si la vérification échoue ensuite. */
  private takeChallenge(session: Session, key: string): string {
    const challenge = session.pull(key) as PasskeyChallenge | undefined
    if (!challenge || challenge.expiresAt < Date.now()) {
      throw new PasskeyVerificationFailedException()
    }
    return challenge.value
  }

  private parse<T>(json: string): T {
    try {
      const value: unknown = JSON.parse(json)
      if (typeof value !== 'object' || value === null) throw new Error('not an object')
      return value as T
    } catch {
      throw new PasskeyVerificationFailedException()
    }
  }
}
