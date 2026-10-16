import { onMounted, ref } from 'vue'
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser'
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser'

/**
 * Récupère les options de la cérémonie WebAuthn. Un `GET` JSON en lecture seule
 * (le défi est stocké en session côté serveur) : seul endpoint JSON du flux, le
 * navigateur en a besoin avant de pouvoir parler à l'authentificateur. Le
 * résultat, lui, repart par une mutation Inertia (`useForm`).
 */
async function fetchOptions<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  })
  if (!response.ok) throw new Error(`passkey options: HTTP ${response.status}`)
  return (await response.json()) as T
}

/** L'utilisateur a fermé ou refusé la fenêtre de l'authentificateur : pas une erreur. */
function isCancelled(error: unknown): boolean {
  return error instanceof Error && (error.name === 'NotAllowedError' || error.name === 'AbortError')
}

/**
 * Cérémonies WebAuthn côté navigateur. Les deux méthodes retournent la réponse
 * de l'authentificateur **sérialisée en JSON** (prête à être postée), ou `null`
 * si l'utilisateur annule ; toute autre erreur est propagée.
 */
export function usePasskey() {
  // Évalué au montage : le rendu serveur (SSR) n'a pas de `navigator`.
  const supported = ref(false)
  onMounted(() => {
    supported.value = browserSupportsWebAuthn()
  })

  async function register(optionsUrl: string): Promise<string | null> {
    const optionsJSON = await fetchOptions<PublicKeyCredentialCreationOptionsJSON>(optionsUrl)
    try {
      return JSON.stringify(await startRegistration({ optionsJSON }))
    } catch (error) {
      if (isCancelled(error)) return null
      throw error
    }
  }

  async function authenticate(optionsUrl: string): Promise<string | null> {
    const optionsJSON = await fetchOptions<PublicKeyCredentialRequestOptionsJSON>(optionsUrl)
    try {
      return JSON.stringify(await startAuthentication({ optionsJSON }))
    } catch (error) {
      if (isCancelled(error)) return null
      throw error
    }
  }

  return { supported, register, authenticate }
}
