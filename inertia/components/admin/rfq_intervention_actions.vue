<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import { BellRing, Lock, TimerOff } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import { ICON_SIZE } from '~/types/ui'
import type { AdminRfqDetail } from '#shared/types/admin_trade'

/**
 * Interventions de la plateforme sur une demande : relancer, faire expirer,
 * clôturer. Chaque bouton n'apparaît que si l'état le permet (`detail`) ; le
 * parent ne rend ce composant que pour un opérateur ayant `trade.manage`.
 * Les trois actions demandent une confirmation (elles notifient ou sont
 * irréversibles) ; le serveur reste seul juge et répond par un flash.
 */
const props = defineProps<{ detail: AdminRfqDetail }>()

const { t, locale } = useI18n()

function run(action: 'close' | 'expire' | 'remind', confirmKey: string) {
  if (!window.confirm(t(confirmKey, { count: props.detail.remindableCount }))) return
  router.post(
    urlFor(`admin.rfqs.${action}`, { locale: locale.value, id: props.detail.item.id }),
    {},
    { preserveScroll: true }
  )
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <BaseButton
      v-if="detail.remindableCount > 0"
      variant="secondary"
      @click="run('remind', 'admin.rfqs.actions.confirmRemind')"
    >
      <template #icon><BellRing :size="ICON_SIZE" aria-hidden="true" /></template>
      {{ t('admin.rfqs.actions.remind', { count: detail.remindableCount }) }}
    </BaseButton>
    <BaseButton
      v-if="detail.canExpire"
      variant="danger"
      @click="run('expire', 'admin.rfqs.actions.confirmExpire')"
    >
      <template #icon><TimerOff :size="ICON_SIZE" aria-hidden="true" /></template>
      {{ t('admin.rfqs.actions.expire') }}
    </BaseButton>
    <BaseButton
      v-if="detail.canClose"
      variant="danger"
      @click="run('close', 'admin.rfqs.actions.confirmClose')"
    >
      <template #icon><Lock :size="ICON_SIZE" aria-hidden="true" /></template>
      {{ t('admin.rfqs.actions.close') }}
    </BaseButton>
  </div>
</template>
