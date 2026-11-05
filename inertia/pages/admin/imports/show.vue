<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import { Download, RotateCcw } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useTradeFormat } from '~/composables/use_trade_format'
import ImportStatusBadge from '~/components/admin/import/import_status_badge.vue'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseButton from '~/components/base/base_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import { BUTTON_BASE_CLASSES, BUTTON_SIZE_CLASSES, BUTTON_VARIANT_CLASSES } from '~/types/ui'
import { IMPORT_ENGINE_AVAILABLE, type AdminImportDetail } from '#shared/types/admin_import'
import { Link } from '@adonisjs/inertia/vue'

const props = defineProps<{ importJob: AdminImportDetail }>()

const { t, locale } = useI18n()
const { dateTime } = useTradeFormat()

function retry() {
  router.post(
    urlFor('admin.imports.retry', { locale: locale.value, id: props.importJob.id }),
    {},
    { preserveScroll: true }
  )
}

const exportClasses = [
  BUTTON_BASE_CLASSES,
  BUTTON_VARIANT_CLASSES.secondary,
  BUTTON_SIZE_CLASSES.md,
]

const dash = '—'
</script>

<template>
  <Head :title="t('admin.imports.showTitle', { id: importJob.id })" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="t('admin.imports.showTitle', { id: importJob.id })"
      :description="t(`admin.imports.kinds.${importJob.kind}`)"
      :back-href="urlFor('admin.imports.index', { locale })"
      :back-label="t('admin.imports.back')"
    >
      <template #meta><ImportStatusBadge :status="importJob.status" /></template>
      <template #actions>
        <div class="flex flex-wrap gap-3">
          <a
            v-if="importJob.errorCount > 0"
            :href="urlFor('admin.imports.errors', { locale, id: importJob.id })"
            :class="exportClasses"
          >
            <Download :size="16" aria-hidden="true" />
            {{ t('admin.imports.exportErrors') }}
          </a>
          <BaseButton v-if="importJob.retryable" @click="retry">
            <RotateCcw :size="16" aria-hidden="true" />
            {{ t('admin.imports.retry') }}
          </BaseButton>
        </div>
      </template>
    </BasePageHeader>

    <BaseAlert v-if="importJob.retryable && !IMPORT_ENGINE_AVAILABLE" tone="warning">
      {{ t('admin.imports.engineNotice') }}
    </BaseAlert>

    <BaseSection :title="t('admin.imports.summary')">
      <dl class="grid gap-4 text-body-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt class="text-text-secondary">{{ t('admin.imports.columns.organization') }}</dt>
          <dd class="font-semibold text-text-primary">
            <Link
              :href="urlFor('admin.organizations.show', { locale, id: importJob.organization.id })"
            >
              {{ importJob.organization.name }}
            </Link>
          </dd>
        </div>
        <div>
          <dt class="text-text-secondary">{{ t('admin.imports.columns.createdBy') }}</dt>
          <dd>{{ importJob.createdBy ?? dash }}</dd>
        </div>
        <div>
          <dt class="text-text-secondary">{{ t('admin.imports.columns.progress') }}</dt>
          <dd class="text-tabular">
            {{
              t('admin.imports.progress', {
                done: importJob.processedRows,
                total: importJob.totalRows,
              })
            }}
          </dd>
        </div>
        <div>
          <dt class="text-text-secondary">{{ t('admin.imports.columns.errors') }}</dt>
          <dd class="text-tabular">{{ importJob.errorCount }}</dd>
        </div>
        <div>
          <dt class="text-text-secondary">{{ t('admin.imports.columns.date') }}</dt>
          <dd>{{ dateTime(importJob.createdAt) }}</dd>
        </div>
        <div>
          <dt class="text-text-secondary">{{ t('admin.imports.finishedAt') }}</dt>
          <dd>{{ importJob.finishedAt ? dateTime(importJob.finishedAt) : dash }}</dd>
        </div>
        <div v-if="importJob.retryOfId">
          <dt class="text-text-secondary">{{ t('admin.imports.retryOf') }}</dt>
          <dd>
            <Link :href="urlFor('admin.imports.show', { locale, id: importJob.retryOfId })">
              #{{ importJob.retryOfId }}
            </Link>
          </dd>
        </div>
        <div v-if="importJob.retriedById">
          <dt class="text-text-secondary">{{ t('admin.imports.retriedBy') }}</dt>
          <dd>
            <Link :href="urlFor('admin.imports.show', { locale, id: importJob.retriedById })">
              #{{ importJob.retriedById }}
            </Link>
          </dd>
        </div>
      </dl>
    </BaseSection>

    <BaseSection
      :title="t('admin.imports.errorsTitle')"
      :description="
        t('admin.imports.errorsDescription', {
          shown: importJob.errors.length,
          total: importJob.errorCount,
        })
      "
      flush
    >
      <p v-if="importJob.errors.length === 0" class="px-6 py-4 text-body-sm text-text-secondary">
        {{ t('admin.imports.noErrors') }}
      </p>
      <BaseTable v-else :caption="t('admin.imports.errorsTitle')">
        <template #head>
          <tr>
            <th scope="col">{{ t('admin.imports.errorColumns.row') }}</th>
            <th scope="col">{{ t('admin.imports.errorColumns.column') }}</th>
            <th scope="col">{{ t('admin.imports.errorColumns.message') }}</th>
            <th scope="col">{{ t('admin.imports.errorColumns.value') }}</th>
          </tr>
        </template>
        <tr v-for="(error, index) in importJob.errors" :key="index">
          <td class="text-tabular">
            {{ error.row === 0 ? t('admin.imports.wholeFile') : error.row }}
          </td>
          <td>{{ error.column ?? dash }}</td>
          <td>{{ error.message }}</td>
          <td>{{ error.receivedValue ?? dash }}</td>
        </tr>
      </BaseTable>
    </BaseSection>
  </div>
</template>
