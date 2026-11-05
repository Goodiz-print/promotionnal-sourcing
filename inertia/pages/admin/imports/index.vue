<script setup lang="ts">
import { reactive, watch } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { FileUp } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useTradeFormat } from '~/composables/use_trade_format'
import ImportStatusBadge from '~/components/admin/import/import_status_badge.vue'
import TradeList from '~/components/admin/trade_list.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseCard from '~/components/base/base_card.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import type { AdminImportFilters, AdminImportRow } from '#shared/types/admin_import'
import type { ImportKind, ImportStatus } from '#shared/types/import_job'
import type { Paginated } from '#shared/types/pagination'

const props = defineProps<{
  imports: Paginated<AdminImportRow>
  filters: AdminImportFilters
  statuses: ImportStatus[]
  kinds: ImportKind[]
}>()

const { t, locale } = useI18n()
const { dateTime } = useTradeFormat()

const model = reactive({ ...props.filters })
// Les filtres du serveur font foi (retour arrière, pagination…).
watch(
  () => props.filters,
  () => Object.assign(model, props.filters),
  { deep: true }
)

function visit(page = 1) {
  const query: Record<string, string | number> = { page }
  if (model.status) query.status = model.status
  if (model.kind) query.kind = model.kind
  if (model.organization?.trim()) query.organization = model.organization.trim()
  router.get(urlFor('admin.imports.index', { locale: locale.value }), query, {
    preserveState: true,
    preserveScroll: true,
    only: ['imports', 'filters'],
  })
}

function reset() {
  Object.assign(model, { status: null, kind: null, organization: null })
  visit()
}

function progress(row: AdminImportRow): string {
  return t('admin.imports.progress', { done: row.processedRows, total: row.totalRows })
}
</script>

<template>
  <Head :title="t('admin.imports.title')" />

  <TradeList
    :title="t('admin.imports.title')"
    :description="t('admin.imports.subtitle')"
    :count-label="t('admin.imports.resultsCount', { count: imports.meta.total })"
    :empty-title="t('admin.imports.empty')"
    :empty-description="t('admin.imports.emptyDescription')"
    :icon="FileUp"
    :meta="imports.meta"
    @page="visit"
  >
    <template #filters>
      <BaseCard padding="md">
        <form class="flex flex-col gap-4" @submit.prevent="visit()">
          <div class="grid gap-4 sm:grid-cols-3">
            <BaseSelect
              id="imports-status"
              v-model="model.status"
              :label="t('admin.imports.filters.status')"
            >
              <option :value="null">{{ t('admin.imports.filters.all') }}</option>
              <option v-for="status in statuses" :key="status" :value="status">
                {{ t(`admin.imports.statuses.${status}`) }}
              </option>
            </BaseSelect>
            <BaseSelect
              id="imports-kind"
              v-model="model.kind"
              :label="t('admin.imports.filters.kind')"
            >
              <option :value="null">{{ t('admin.imports.filters.all') }}</option>
              <option v-for="kind in kinds" :key="kind" :value="kind">
                {{ t(`admin.imports.kinds.${kind}`) }}
              </option>
            </BaseSelect>
            <BaseInput
              id="imports-organization"
              :model-value="model.organization ?? ''"
              :label="t('admin.imports.filters.organization')"
              @update:model-value="model.organization = $event"
            />
          </div>
          <div class="flex justify-end gap-3">
            <BaseButton variant="secondary" size="sm" @click="reset">
              {{ t('admin.trade.filters.reset') }}
            </BaseButton>
            <BaseButton type="submit" size="sm">{{ t('admin.trade.filters.apply') }}</BaseButton>
          </div>
        </form>
      </BaseCard>
    </template>

    <template #head>
      <tr>
        <th scope="col">{{ t('admin.imports.columns.id') }}</th>
        <th scope="col">{{ t('admin.imports.columns.organization') }}</th>
        <th scope="col">{{ t('admin.imports.columns.kind') }}</th>
        <th scope="col">{{ t('admin.imports.columns.status') }}</th>
        <th scope="col">{{ t('admin.imports.columns.progress') }}</th>
        <th scope="col">{{ t('admin.imports.columns.errors') }}</th>
        <th scope="col">{{ t('admin.imports.columns.date') }}</th>
      </tr>
    </template>

    <tr v-for="row in imports.data" :key="row.id">
      <td class="font-semibold text-text-primary">
        <Link :href="urlFor('admin.imports.show', { locale, id: row.id })">#{{ row.id }}</Link>
      </td>
      <td>
        <Link :href="urlFor('admin.organizations.show', { locale, id: row.organization.id })">
          {{ row.organization.name }}
        </Link>
      </td>
      <td>{{ t(`admin.imports.kinds.${row.kind}`) }}</td>
      <td><ImportStatusBadge :status="row.status" /></td>
      <td class="text-tabular">{{ progress(row) }}</td>
      <td class="text-tabular">{{ row.errorCount }}</td>
      <td>{{ dateTime(row.createdAt) }}</td>
    </tr>
  </TradeList>
</template>
