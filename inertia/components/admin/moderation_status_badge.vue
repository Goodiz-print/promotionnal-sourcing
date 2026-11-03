<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import type { BadgeTone } from '~/types/ui'
import type { ModerationStatus } from '#shared/types/moderation'

/** Pastille du statut de modération d'un élément. */
defineProps<{ status: ModerationStatus }>()

const { t } = useI18n()

const TONES: Record<ModerationStatus, BadgeTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
}
</script>

<template>
  <BaseBadge :tone="TONES[status]">{{ t(`admin.moderation.statuses.${status}`) }}</BaseBadge>
</template>
