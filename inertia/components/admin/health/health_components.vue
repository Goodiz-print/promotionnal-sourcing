<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '~/i18n'
import { useTradeFormat } from '~/composables/use_trade_format'
import HealthStatusBadge from '~/components/admin/health/health_status_badge.vue'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import type {
  HealthComponent,
  HealthComponentState,
  PlatformHealthReport,
} from '#shared/types/admin_health'

/**
 * Rapport sondé en direct, composant par composant, avec — quand le job de
 * surveillance est passé — depuis quand le composant a ce statut et si une alerte
 * a été envoyée.
 */
const props = defineProps<{ report: PlatformHealthReport; states: HealthComponentState[] }>()

const { t } = useI18n()
const { dateTime } = useTradeFormat()

const stateOf = computed(
  () => new Map<HealthComponent, HealthComponentState>(props.states.map((s) => [s.component, s]))
)
const TONES = { ok: 'success', degraded: 'warning', down: 'danger' } as const
</script>

<template>
  <BaseSection
    :title="t('admin.health.components.title')"
    :description="t('admin.health.components.checkedAt', { date: dateTime(report.checkedAt) })"
  >
    <div class="flex flex-col gap-4">
      <BaseAlert :tone="TONES[report.status]" data-testid="health-overall">
        {{ t(`admin.health.overall.${report.status}`) }}
      </BaseAlert>

      <BaseTable :caption="t('admin.health.components.title')">
        <template #head>
          <tr>
            <th scope="col">{{ t('admin.health.columns.component') }}</th>
            <th scope="col">{{ t('admin.health.columns.status') }}</th>
            <th scope="col" class="text-right">{{ t('admin.health.columns.latency') }}</th>
            <th scope="col">{{ t('admin.health.columns.detail') }}</th>
            <th scope="col">{{ t('admin.health.columns.since') }}</th>
            <th scope="col">{{ t('admin.health.columns.alert') }}</th>
          </tr>
        </template>
        <tr
          v-for="row in report.components"
          :key="row.component"
          :data-testid="`health-${row.component}`"
        >
          <td>
            <div class="font-semibold text-text-primary">
              {{ t(`admin.health.names.${row.component}`) }}
            </div>
            <div class="text-caption text-text-muted">
              {{ t(`admin.health.hints.${row.component}`) }}
            </div>
          </td>
          <td><HealthStatusBadge :status="row.status" /></td>
          <td class="text-tabular text-right">
            {{ row.latencyMs === null ? '—' : t('admin.health.ms', { count: row.latencyMs }) }}
          </td>
          <td class="text-text-secondary">{{ row.detail ?? '—' }}</td>
          <td class="text-text-secondary">
            {{ stateOf.get(row.component) ? dateTime(stateOf.get(row.component)!.since) : '—' }}
          </td>
          <td class="text-text-secondary">
            {{
              stateOf.get(row.component)?.alerted
                ? t('admin.health.alerted')
                : t('admin.health.notAlerted')
            }}
          </td>
        </tr>
      </BaseTable>
    </div>
  </BaseSection>
</template>
