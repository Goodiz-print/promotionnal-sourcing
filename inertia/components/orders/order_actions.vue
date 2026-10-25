<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import BaseButton from '~/components/base/base_button.vue'
import { actionRoute } from '~/components/orders/types'
import type { OrderAction, OrderSide, OrderType } from '#shared/types/order'

/**
 * Boutons des actions ouvertes **maintenant** sur une commande : le serveur les
 * liste (`order.actions`), le client ne fait que les afficher. Annuler est
 * définitif, d'où la confirmation, comme pour les autres décisions.
 */
const props = defineProps<{ order: OrderType; side: OrderSide }>()

const { t, locale } = useI18n()

function run(action: OrderAction) {
  const route = actionRoute(props.side, action)
  if (!route || !window.confirm(t(`order.confirm.${action}`))) return
  router.patch(
    urlFor(route, { locale: locale.value, id: props.order.id }),
    {},
    { preserveScroll: true }
  )
}
</script>

<template>
  <div v-if="order.actions.length > 0" class="flex flex-wrap items-center gap-3">
    <BaseButton
      v-for="action in order.actions"
      :key="action"
      :variant="action === 'cancel' ? 'danger' : 'secondary'"
      @click="run(action)"
    >
      {{ t(`order.actions.${action}`) }}
    </BaseButton>
  </div>
</template>
