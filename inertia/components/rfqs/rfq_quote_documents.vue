<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import { CircleCheck, Download, FileText } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { formatShortDate } from '#shared/helpers/date'
import { urlFor } from '~/client'
import { useConfirm } from '~/composables/use_confirm'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { QuoteDocumentType } from '#shared/types/quote'

/**
 * Devis PDF reçus par mail (#224), dans une `BaseSection flush` de l'écran de
 * la demande (#228). Le lien de téléchargement passe par la route réservée aux
 * membres de l'agence ; « Retenir » clôture la demande, sans commande.
 */
defineProps<{
  documents: QuoteDocumentType[]
  /** Responsable de l'agence, demande encore ouverte. */
  canSelect: boolean
}>()

const { t, locale } = useI18n()
const { confirm } = useConfirm()

function downloadUrl(document: QuoteDocumentType): string {
  return urlFor('quote_documents.download', { locale: locale.value, id: document.id })
}

/** Date courte dans la langue de l'interface (lie `formatShortDate` à la locale courante). */
function formatDate(value: string): string {
  return formatShortDate(value, locale.value)
}

async function select(document: QuoteDocumentType) {
  const confirmed = await confirm({
    title: t('quote.documents.confirmSelectTitle'),
    message: t('quote.documents.confirmSelect'),
    confirmLabel: t('quote.documents.select'),
  })
  if (!confirmed) return
  router.post(
    urlFor('quote_documents.select', { locale: locale.value, id: document.id }),
    {},
    { preserveScroll: true }
  )
}
</script>

<template>
  <BaseEmptyState
    v-if="documents.length === 0"
    compact
    :title="t('quote.documents.empty')"
    :icon="FileText"
  />

  <BaseTable v-else bare :caption="t('quote.documents.title')">
    <template #head>
      <tr>
        <th scope="col">{{ t('quote.documents.columns.supplier') }}</th>
        <th scope="col">{{ t('quote.documents.columns.file') }}</th>
        <th scope="col">{{ t('quote.documents.columns.receivedAt') }}</th>
        <th scope="col">{{ t('quote.documents.columns.decision') }}</th>
      </tr>
    </template>

    <tr v-for="document in documents" :key="document.id">
      <td class="font-semibold text-text-primary">{{ document.supplierName }}</td>
      <td>
        <a
          :href="downloadUrl(document)"
          :aria-label="t('quote.documents.download', { filename: document.filename })"
          class="inline-flex items-center gap-1.5 text-text-primary hover:text-indigo-600"
          download
        >
          <Download :size="16" aria-hidden="true" />
          {{ document.filename }}
        </a>
      </td>
      <td class="text-tabular whitespace-nowrap">{{ formatDate(document.receivedAt) }}</td>
      <td>
        <BaseBadge v-if="document.selectedAt" tone="success">
          <CircleCheck :size="14" aria-hidden="true" />
          {{ t('quote.documents.selected') }}
        </BaseBadge>
        <BaseButton v-else-if="canSelect" variant="secondary" size="sm" @click="select(document)">
          {{ t('quote.documents.select') }}
        </BaseButton>
      </td>
    </tr>
  </BaseTable>
</template>
