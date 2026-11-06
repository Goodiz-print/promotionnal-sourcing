<script setup lang="ts">
import { computed, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { Scale } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { useTradeFormat } from '~/composables/use_trade_format'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseSection from '~/components/base/base_section.vue'
import type { AdminSearchDrift, AdminSearchDriftFailure } from '#shared/types/admin_search'

/**
 * Écart PostgreSQL ↔ index. Le calcul parcourt tout le catalogue : il est
 * demandé par un rechargement partiel (`drift`), jamais au chargement de la page.
 * `drift` : `undefined` tant que non demandé ; `unavailable` dit pourquoi il est incalculable.
 */
const props = defineProps<{
  drift?: AdminSearchDrift | AdminSearchDriftFailure
  available: boolean
}>()

const { t } = useI18n()
const { dateTime } = useTradeFormat()
const loading = ref(false)

function check() {
  router.reload({
    only: ['drift'],
    onStart: () => (loading.value = true),
    onFinish: () => (loading.value = false),
  })
}

const result = computed(() => (props.drift && !('unavailable' in props.drift) ? props.drift : null))
const failure = computed(() => (props.drift && 'unavailable' in props.drift ? props.drift : null))
const inSync = computed(
  () => result.value !== null && result.value.missingCount === 0 && result.value.extraCount === 0
)
</script>

<template>
  <BaseSection :title="t('admin.search.drift.title')" :description="t('admin.search.drift.hint')">
    <div class="flex flex-col gap-4">
      <div>
        <BaseButton variant="secondary" :disabled="!available || loading" @click="check">
          <Scale :size="16" aria-hidden="true" />
          {{ t('admin.search.drift.check') }}
        </BaseButton>
      </div>

      <BaseAlert v-if="failure" tone="danger">
        {{ t(`admin.search.drift.unavailable.${failure.unavailable}`) }}
      </BaseAlert>

      <template v-else-if="result">
        <BaseAlert :tone="inSync ? 'success' : 'warning'">
          {{ t(inSync ? 'admin.search.drift.inSync' : 'admin.search.drift.outOfSync') }}
          <span class="block text-caption">
            {{ t('admin.search.drift.checkedAt', { date: dateTime(result.checkedAt) }) }}
          </span>
        </BaseAlert>

        <dl class="grid gap-4 text-body-sm sm:grid-cols-4">
          <div>
            <dt class="text-text-secondary">{{ t('admin.search.drift.expected') }}</dt>
            <dd class="text-tabular font-semibold text-text-primary">{{ result.expected }}</dd>
          </div>
          <div>
            <dt class="text-text-secondary">{{ t('admin.search.drift.indexed') }}</dt>
            <dd class="text-tabular font-semibold text-text-primary">{{ result.indexed }}</dd>
          </div>
          <div>
            <dt class="text-text-secondary">{{ t('admin.search.drift.missing') }}</dt>
            <dd class="text-tabular font-semibold text-text-primary">{{ result.missingCount }}</dd>
            <dd v-if="result.missing.length > 0" class="text-caption text-text-muted">
              {{ t('admin.search.drift.sample', { ids: result.missing.join(', ') }) }}
            </dd>
          </div>
          <div>
            <dt class="text-text-secondary">{{ t('admin.search.drift.extra') }}</dt>
            <dd class="text-tabular font-semibold text-text-primary">{{ result.extraCount }}</dd>
            <dd v-if="result.extra.length > 0" class="text-caption text-text-muted">
              {{ t('admin.search.drift.sample', { ids: result.extra.join(', ') }) }}
            </dd>
          </div>
        </dl>
      </template>
    </div>
  </BaseSection>
</template>
