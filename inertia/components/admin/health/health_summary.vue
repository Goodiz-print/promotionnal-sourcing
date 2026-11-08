<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@adonisjs/inertia/vue'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import { useTradeFormat } from '~/composables/use_trade_format'
import HealthStatusBadge from '~/components/admin/health/health_status_badge.vue'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseSection from '~/components/base/base_section.vue'
import type { PlatformHealthSummary } from '#shared/types/admin_health'

/**
 * Tableau de bord : derniers états connus du job de surveillance (aucune sonde à
 * l'affichage), lien vers l'écran de santé.
 */
const props = defineProps<{ summary: PlatformHealthSummary }>()

const { t, locale } = useI18n()
const { dateTime } = useTradeFormat()

const TONES = { ok: 'success', degraded: 'warning', down: 'danger' } as const
const empty = computed(() => props.summary.checkedAt === null)
</script>

<template>
  <BaseSection
    :title="t('admin.health.summary.title')"
    :description="
      summary.checkedAt
        ? t('admin.health.components.checkedAt', { date: dateTime(summary.checkedAt) })
        : undefined
    "
  >
    <div class="flex flex-col gap-4">
      <BaseAlert :tone="empty ? 'info' : TONES[summary.status]" data-testid="health-summary">
        {{ empty ? t('admin.health.summary.empty') : t(`admin.health.overall.${summary.status}`) }}
        <Link :href="urlFor('admin.health.index', { locale })" class="ml-2 font-semibold underline">
          {{ t('admin.health.summary.details') }}
        </Link>
      </BaseAlert>

      <ul v-if="!empty" class="flex flex-wrap gap-x-6 gap-y-2 text-body-sm">
        <li
          v-for="state in summary.components"
          :key="state.component"
          class="flex items-center gap-2"
        >
          <span class="text-text-secondary">{{ t(`admin.health.names.${state.component}`) }}</span>
          <HealthStatusBadge :status="state.status" />
        </li>
      </ul>
    </div>
  </BaseSection>
</template>
