<script setup lang="ts">
import { computed } from 'vue'
import { RotateCw } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { useMailActions } from '~/composables/use_mail_actions'
import BaseButton from '~/components/base/base_button.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { AdminMailOverview } from '#shared/types/admin_ops'
import type { MailKind } from '#shared/types/mail'

/** Taux d'échec par type de mail sur la fenêtre de l'aperçu, et rejeu de la dead-letter. */
const props = defineProps<{ overview: AdminMailOverview }>()

const { t, locale } = useI18n()
const { retryAll } = useMailActions()

const percent = computed(
  () => new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 1 })
)
const rate = (value: number | null) => (value === null ? '—' : percent.value.format(value))
</script>

<template>
  <BaseSection
    :title="t('admin.mail.rates.title')"
    :description="t('admin.mail.rates.description', { days: props.overview.windowDays })"
    flush
  >
    <div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
      <p class="text-body-sm text-text-secondary">
        {{ t('admin.mail.rates.failedTotal', { count: props.overview.failedTotal }) }}
      </p>
      <BaseButton size="sm" :disabled="props.overview.failedTotal === 0" @click="retryAll(null)">
        <RotateCw :size="16" aria-hidden="true" />
        {{ t('admin.mail.actions.retryAll') }}
      </BaseButton>
    </div>

    <p v-if="props.overview.rates.length === 0" class="px-6 pb-4 text-body-sm text-text-secondary">
      {{ t('admin.mail.rates.empty') }}
    </p>
    <BaseTable v-else :caption="t('admin.mail.rates.title')">
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.mail.columns.kind') }}</th>
          <th scope="col">{{ t('admin.mail.rates.sent') }}</th>
          <th scope="col">{{ t('admin.mail.rates.failed') }}</th>
          <th scope="col">{{ t('admin.mail.rates.inProgress') }}</th>
          <th scope="col">{{ t('admin.mail.rates.rate') }}</th>
          <th scope="col">
            <span class="sr-only">{{ t('admin.mail.columns.actions') }}</span>
          </th>
        </tr>
      </template>
      <tr v-for="row in props.overview.rates" :key="row.kind">
        <td class="font-semibold text-text-primary">{{ t(`admin.mail.kinds.${row.kind}`) }}</td>
        <td class="text-tabular">{{ row.sent }}</td>
        <td class="text-tabular">{{ row.failed }}</td>
        <td class="text-tabular">{{ row.inProgress }}</td>
        <td class="text-tabular">{{ rate(row.failureRate) }}</td>
        <td class="text-right">
          <BaseButton
            v-if="row.failed > 0"
            variant="secondary"
            size="sm"
            @click="retryAll(row.kind as MailKind)"
          >
            {{ t('admin.mail.actions.retryKind') }}
          </BaseButton>
        </td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
