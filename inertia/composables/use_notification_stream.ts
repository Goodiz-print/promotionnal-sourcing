import { onBeforeUnmount, onMounted } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { Transmit } from '@adonisjs/transmit-client'
import type { Data } from '@generated/data'
import { userNotificationsChannel, type RealtimeEvent } from '#shared/types/realtime'

type Subscription = ReturnType<Transmit['subscription']>

/**
 * Écoute le canal privé de l'utilisateur connecté (#57) et appelle `onCreated`
 * à chaque `notification.created`. Le serveur n'autorise que le propriétaire du
 * canal (`start/transmit.ts`). Sans effet hors navigateur et hors connexion.
 *
 * Un échec de connexion ne casse rien : la cloche reste exacte au prochain
 * chargement de page, le temps réel n'est qu'un confort.
 */
export function useNotificationStream(onCreated: () => void) {
  const page = usePage<Data.SharedProps>()
  let transmit: Transmit | undefined
  let subscription: Subscription | undefined

  onMounted(async () => {
    const userId = page.props.user?.id
    if (!userId) return

    try {
      transmit = new Transmit({ baseUrl: window.location.origin })
      subscription = transmit.subscription(userNotificationsChannel(userId))
      subscription.onMessage((event: RealtimeEvent) => {
        if (event.type === 'notification.created') onCreated()
      })
      await subscription.create()
    } catch {
      // Pas de temps réel : la pastille se met à jour à la navigation suivante.
    }
  })

  onBeforeUnmount(() => {
    void subscription?.delete()
    transmit?.close()
  })
}
