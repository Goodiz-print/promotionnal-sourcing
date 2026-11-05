<script setup lang="ts">
import { reactive, watch } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { Download, FileCheck2 } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useTradeFormat } from '~/composables/use_trade_format'
import TradeList from '~/components/admin/trade_list.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseCard from '~/components/base/base_card.vue'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import { BUTTON_BASE_CLASSES, BUTTON_SIZE_CLASSES, BUTTON_VARIANT_CLASSES } from '~/types/ui'
import type {
  AdminConsentFilters,
  AdminConsentOverview,
  AdminConsentRow,
} from '#shared/types/admin_consent'
import { LEGAL_CONSENT_KINDS } from '#shared/types/legal'
import type { Paginated } from '#shared/types/pagination'

const props = defineProps<{
  consents: Paginated<AdminConsentRow>
  overview: AdminConsentOverview
  filters: AdminConsentFilters
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
  if (model.organization?.trim()) query.organization = model.organization.trim()
  if (model.user?.trim()) query.user = model.user.trim()
  if (model.kind) query.kind = model.kind
  if (model.version?.trim()) query.version = model.version.trim()
  if (model.outdated) query.outdated = 1
  router.get(urlFor('admin.consents.index', { locale: locale.value }), query, {
    preserveState: true,
    preserveScroll: true,
    only: ['consents', 'overview', 'filters'],
  })
}

function reset() {
  Object.assign(model, {
    organization: null,
    user: null,
    kind: null,
    version: null,
    outdated: false,
  })
  visit()
}

const exportHref = (row: AdminConsentRow) =>
  `${urlFor('admin.consents.export', { locale: locale.value })}?organizationId=${row.organization.id}`

const exportClasses = [
  BUTTON_BASE_CLASSES,
  BUTTON_VARIANT_CLASSES.secondary,
  BUTTON_SIZE_CLASSES.sm,
]
</script>

<template>
  <Head :title="t('admin.consents.title')" />

  <TradeList
    :title="t('admin.consents.title')"
    :description="t('admin.consents.subtitle', { version: overview.currentVersion })"
    :count-label="t('admin.consents.resultsCount', { count: consents.meta.total })"
    :empty-title="t('admin.consents.empty')"
    :empty-description="t('admin.consents.emptyDescription')"
    :icon="FileCheck2"
    :meta="consents.meta"
    @page="visit"
  >
    <template #filters>
      <BaseCard padding="md">
        <form class="flex flex-col gap-4" @submit.prevent="visit()">
          <p class="text-body-sm text-text-secondary">
            {{
              t('admin.consents.outdatedSummary', {
                count: overview.outdatedCount,
                version: overview.currentVersion,
              })
            }}
          </p>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <BaseInput
              id="consents-organization"
              :model-value="model.organization ?? ''"
              :label="t('admin.consents.filters.organization')"
              @update:model-value="model.organization = $event"
            />
            <BaseInput
              id="consents-user"
              :model-value="model.user ?? ''"
              :label="t('admin.consents.filters.user')"
              @update:model-value="model.user = $event"
            />
            <BaseSelect
              id="consents-kind"
              v-model="model.kind"
              :label="t('admin.consents.filters.kind')"
            >
              <option :value="null">{{ t('admin.consents.filters.allKinds') }}</option>
              <option v-for="kind in LEGAL_CONSENT_KINDS" :key="kind" :value="kind">
                {{ t(`admin.consents.kinds.${kind}`) }}
              </option>
            </BaseSelect>
            <BaseInput
              id="consents-version"
              :model-value="model.version ?? ''"
              :label="t('admin.consents.filters.version')"
              @update:model-value="model.version = $event"
            />
          </div>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <BaseCheckbox
              id="consents-outdated"
              v-model="model.outdated"
              :label="t('admin.consents.filters.outdated')"
            />
            <div class="flex gap-3">
              <BaseButton variant="secondary" size="sm" @click="reset">
                {{ t('admin.trade.filters.reset') }}
              </BaseButton>
              <BaseButton type="submit" size="sm">{{ t('admin.trade.filters.apply') }}</BaseButton>
            </div>
          </div>
        </form>
      </BaseCard>
    </template>

    <template #head>
      <tr>
        <th scope="col">{{ t('admin.consents.columns.organization') }}</th>
        <th scope="col">{{ t('admin.consents.columns.user') }}</th>
        <th scope="col">{{ t('admin.consents.columns.kind') }}</th>
        <th scope="col">{{ t('admin.consents.columns.version') }}</th>
        <th scope="col">{{ t('admin.consents.columns.acceptedAt') }}</th>
        <th scope="col">{{ t('admin.consents.columns.ip') }}</th>
        <th scope="col">{{ t('admin.trade.columns.status') }}</th>
        <th scope="col">
          <span class="sr-only">{{ t('admin.consents.export') }}</span>
        </th>
      </tr>
    </template>

    <tr v-for="row in consents.data" :key="row.id">
      <td class="font-semibold text-text-primary">
        <Link :href="urlFor('admin.organizations.show', { locale, id: row.organization.id })">
          {{ row.organization.name }}
        </Link>
      </td>
      <td>{{ row.user?.email ?? '—' }}</td>
      <td>{{ t(`admin.consents.kinds.${row.kind}`) }}</td>
      <td class="text-tabular">{{ row.version }}</td>
      <td>{{ dateTime(row.acceptedAt) }}</td>
      <td class="text-tabular">{{ row.ipAddress ?? '—' }}</td>
      <td>
        <BaseBadge v-if="row.revokedAt" tone="neutral">
          {{ t('admin.consents.revoked') }}
        </BaseBadge>
        <BaseBadge v-else-if="row.outdated" tone="warning">
          {{ t('admin.consents.outdated') }}
        </BaseBadge>
        <BaseBadge v-else tone="success">{{ t('admin.consents.active') }}</BaseBadge>
      </td>
      <td class="text-right">
        <a :href="exportHref(row)" download :class="exportClasses">
          <Download :size="16" aria-hidden="true" />
          {{ t('admin.consents.export') }}
        </a>
      </td>
    </tr>
  </TradeList>
</template>
