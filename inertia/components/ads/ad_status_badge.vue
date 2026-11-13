<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import type { AdCampaignStatus } from '#shared/types/ads'

/** Pastille de statut d'une campagne de sponsorisation. */
defineProps<{ status: AdCampaignStatus }>()

const { t } = useI18n()

const TONES = { active: 'success', paused: 'neutral', suspended: 'danger' } as const
</script>

<template>
  <BaseBadge dot :tone="TONES[status]">{{ t(`ads.status.${status}`) }}</BaseBadge>
</template>
