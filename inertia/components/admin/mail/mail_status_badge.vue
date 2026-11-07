<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import type { AdminMailStatus } from '#shared/types/admin_ops'

/** Pastille d'état d'un envoi : parti, en échec (dead-letter) ou en cours. */
defineProps<{ status: AdminMailStatus }>()

const { t } = useI18n()

const TONES: Record<AdminMailStatus, 'success' | 'danger' | 'info'> = {
  sent: 'success',
  failed: 'danger',
  in_progress: 'info',
}
</script>

<template>
  <BaseBadge :tone="TONES[status]">{{ t(`admin.mail.statuses.${status}`) }}</BaseBadge>
</template>
