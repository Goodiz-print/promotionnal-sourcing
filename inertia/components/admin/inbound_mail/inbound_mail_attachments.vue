<script setup lang="ts">
import { computed } from 'vue'
import { Paperclip } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { BadgeTone } from '~/types/ui'
import type { AdminInboundMailAttachment } from '#shared/types/admin_inbound_mail'
import type { InboundAttachmentStatus } from '#shared/types/inbound_mail'

/** Pièces jointes journalisées d'un mail entrant, et leur sort (stockée, refusée…). */
const props = defineProps<{ attachments: AdminInboundMailAttachment[] }>()

const { t, locale } = useI18n()

const TONES: Record<InboundAttachmentStatus, BadgeTone> = {
  stored: 'success',
  rejected_type: 'warning',
  rejected_size: 'warning',
  ignored_inline: 'neutral',
}

const kilobytes = computed(
  () => new Intl.NumberFormat(locale.value, { style: 'unit', unit: 'kilobyte' })
)
const size = (bytes: number | null) =>
  bytes === null ? '—' : kilobytes.value.format(Math.ceil(bytes / 1024))
</script>

<template>
  <BaseSection :title="t('admin.inboundMail.attachments.title')">
    <BaseEmptyState
      v-if="props.attachments.length === 0"
      compact
      :title="t('admin.inboundMail.attachments.empty')"
      :icon="Paperclip"
    />
    <BaseTable v-else :caption="t('admin.inboundMail.attachments.title')">
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.inboundMail.attachments.columns.filename') }}</th>
          <th scope="col">{{ t('admin.inboundMail.attachments.columns.type') }}</th>
          <th scope="col">{{ t('admin.inboundMail.attachments.columns.size') }}</th>
          <th scope="col">{{ t('admin.inboundMail.attachments.columns.status') }}</th>
        </tr>
      </template>
      <tr v-for="attachment in props.attachments" :key="attachment.id">
        <td class="break-all">{{ attachment.filename }}</td>
        <td>{{ attachment.mimeType ?? '—' }}</td>
        <td class="text-tabular">{{ size(attachment.sizeBytes) }}</td>
        <td>
          <BaseBadge :tone="TONES[attachment.status]">
            {{ t(`admin.inboundMail.attachments.statuses.${attachment.status}`) }}
          </BaseBadge>
        </td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
