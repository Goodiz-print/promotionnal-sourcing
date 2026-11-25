<script setup lang="ts">
import { Download, FileText } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseTable from '~/components/base/base_table.vue'
import { formatShortDate } from '#shared/helpers/date'
import { formatFileSize } from '#shared/helpers/file_size'
import type { SupplierQuoteDocumentType } from '#shared/types/quote'

/**
 * Devis PDF envoyés par le fournisseur sur une demande reçue (#230), dans une
 * `BaseSection flush`. Le lien sert toujours son fichier **d'origine** (route
 * réservée au destinataire), jamais la copie au nom de l'agence (#238).
 */
defineProps<{ documents: SupplierQuoteDocumentType[] }>()

const { t, locale } = useI18n()
</script>

<template>
  <BaseEmptyState
    v-if="documents.length === 0"
    compact
    :title="t('quote.supplier.documents.empty')"
    :icon="FileText"
  />

  <BaseTable v-else bare :caption="t('quote.supplier.documents.title')">
    <template #head>
      <tr>
        <th scope="col">{{ t('quote.supplier.documents.columns.file') }}</th>
        <th scope="col">{{ t('quote.supplier.documents.columns.sentAt') }}</th>
        <th scope="col">{{ t('quote.supplier.documents.columns.channel') }}</th>
      </tr>
    </template>

    <tr v-for="document in documents" :key="document.id" data-test="sent-quote-document">
      <td>
        <a
          :href="urlFor('supplier.quote_documents.download', { locale, id: document.id })"
          :aria-label="t('quote.supplier.documents.download', { filename: document.filename })"
          class="inline-flex items-center gap-1.5 font-semibold text-text-primary hover:text-text-brand"
          download
        >
          <Download :size="16" aria-hidden="true" />
          {{ document.filename }}
        </a>
        <span class="ml-2 text-body-sm text-text-muted">{{
          formatFileSize(document.sizeBytes)
        }}</span>
      </td>
      <td class="text-tabular whitespace-nowrap">
        {{ formatShortDate(document.receivedAt, locale) }}
      </td>
      <td>
        <BaseBadge tone="neutral">
          {{ t(`quote.supplier.documents.channel.${document.viaMail ? 'mail' : 'upload'}`) }}
        </BaseBadge>
      </td>
    </tr>
  </BaseTable>
</template>
