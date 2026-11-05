<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import type { ImportStatus } from '#shared/types/import_job'

/** Pastille de statut d'un import. */
defineProps<{ status: ImportStatus }>()

const { t } = useI18n()

const TONES: Record<ImportStatus, 'neutral' | 'info' | 'success' | 'danger'> = {
  pending: 'neutral',
  running: 'info',
  completed: 'success',
  failed: 'danger',
}
</script>

<template>
  <BaseBadge :tone="TONES[status]">{{ t(`admin.imports.statuses.${status}`) }}</BaseBadge>
</template>
