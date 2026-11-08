<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import type { HealthStatus } from '#shared/types/admin_health'

/** Pastille de statut d'un composant : sain, dégradé, en panne ou non configuré. */
defineProps<{ status: HealthStatus }>()

const { t } = useI18n()

const TONES: Record<HealthStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ok: 'success',
  degraded: 'warning',
  down: 'danger',
  disabled: 'neutral',
}
</script>

<template>
  <BaseBadge :tone="TONES[status]" dot>{{ t(`admin.health.statuses.${status}`) }}</BaseBadge>
</template>
