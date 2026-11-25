<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import type { BadgeTone } from '~/types/ui'
import type { InboundMailRejection, InboundMailStatus } from '#shared/types/inbound_mail'

/** Pastille d'état d'un mail entrant, avec le motif s'il a été écarté. */
const props = defineProps<{
  status: InboundMailStatus
  rejectionReason?: InboundMailRejection | null
}>()

const { t } = useI18n()

const TONES: Record<InboundMailStatus, BadgeTone> = {
  received: 'info',
  processing: 'info',
  processed: 'success',
  rejected: 'warning',
  failed: 'danger',
}
</script>

<template>
  <span class="inline-flex flex-wrap items-center gap-1.5">
    <BaseBadge :tone="TONES[props.status]">
      {{ t(`admin.inboundMail.statuses.${props.status}`) }}
    </BaseBadge>
    <span v-if="props.rejectionReason" class="text-caption text-text-secondary">
      {{ t(`admin.inboundMail.rejections.${props.rejectionReason}`) }}
    </span>
  </span>
</template>
