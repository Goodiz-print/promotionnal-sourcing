<script setup lang="ts">
import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { Scale } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { useTradeFormat } from '~/composables/use_trade_format'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseSection from '~/components/base/base_section.vue'
import type { AdminSearchDrift } from '#shared/types/admin_search'

/**
 * Écart PostgreSQL ↔ index. Le calcul parcourt tout le catalogue : il est
 * demandé par un rechargement partiel (`drift`), jamais au chargement de la page.
 * `drift` : `undefined` tant que non demandé, `null` si le moteur n'a pas répondu.
 */
const props = defineProps<{ drift?: AdminSearchDrift | null; available: boolean }>()

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

const inSync = () =>
  props.drift !== undefined &&
  props.drift !== null &&
  props.drift.missingCount === 0 &&
  props.drift.extraCount === 0
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

      <BaseAlert v-if="drift === null" tone="danger">
        {{ t('admin.search.drift.unavailable') }}
      </BaseAlert>

      <template v-else-if="drift">
        <BaseAlert :tone="inSync() ? 'success' : 'warning'">
          {{ t(inSync() ? 'admin.search.drift.inSync' : 'admin.search.drift.outOfSync') }}
          <span class="block text-caption">
            {{ t('admin.search.drift.checkedAt', { date: dateTime(drift.checkedAt) }) }}
          </span>
        </BaseAlert>

        <dl class="grid gap-4 text-body-sm sm:grid-cols-4">
          <div>
            <dt class="text-text-secondary">{{ t('admin.search.drift.expected') }}</dt>
            <dd class="text-tabular font-semibold text-text-primary">{{ drift.expected }}</dd>
          </div>
          <div>
            <dt class="text-text-secondary">{{ t('admin.search.drift.indexed') }}</dt>
            <dd class="text-tabular font-semibold text-text-primary">{{ drift.indexed }}</dd>
          </div>
          <div>
            <dt class="text-text-secondary">{{ t('admin.search.drift.missing') }}</dt>
            <dd class="text-tabular font-semibold text-text-primary">{{ drift.missingCount }}</dd>
            <dd v-if="drift.missing.length > 0" class="text-caption text-text-muted">
              {{ t('admin.search.drift.sample', { ids: drift.missing.join(', ') }) }}
            </dd>
          </div>
          <div>
            <dt class="text-text-secondary">{{ t('admin.search.drift.extra') }}</dt>
            <dd class="text-tabular font-semibold text-text-primary">{{ drift.extraCount }}</dd>
            <dd v-if="drift.extra.length > 0" class="text-caption text-text-muted">
              {{ t('admin.search.drift.sample', { ids: drift.extra.join(', ') }) }}
            </dd>
          </div>
        </dl>
      </template>
    </div>
  </BaseSection>
</template>
