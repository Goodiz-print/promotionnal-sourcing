<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import type { BadgeTone } from '~/types/ui'
import type { AgencyReviewStatus } from '#shared/types/agency_review'

/** Pastille du statut de revue d'une inscription agence. */
defineProps<{ status: AgencyReviewStatus }>()

const { t } = useI18n()

const TONES: Record<AgencyReviewStatus, BadgeTone> = {
  pending: 'warning',
  info_requested: 'info',
  approved: 'success',
  rejected: 'danger',
}
</script>

<template>
  <BaseBadge :tone="TONES[status]">{{ t(`admin.agencyReviews.statuses.${status}`) }}</BaseBadge>
</template>
