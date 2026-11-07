<script setup lang="ts">
import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { RotateCw } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseSection from '~/components/base/base_section.vue'
import { formatFileSize } from '#shared/helpers/file_size'
import type { AdminStorageOverview } from '#shared/types/admin_ops'

/**
 * Registre `storage_objects` par état, arriéré de reprise et relance de la reprise
 * (`RecoverStorageUploadsJob`).
 */
const props = defineProps<{ overview: AdminStorageOverview }>()

const { t, locale } = useI18n()
const sending = ref(false)

function recover() {
  if (!window.confirm(t('admin.storage.recover.confirm'))) return
  router.post(
    urlFor('admin.storage.recover', { locale: locale.value }),
    {},
    {
      preserveScroll: true,
      onStart: () => (sending.value = true),
      onFinish: () => (sending.value = false),
    }
  )
}
</script>

<template>
  <BaseSection
    :title="t('admin.storage.totals.title')"
    :description="t('admin.storage.totals.description')"
  >
    <div class="flex flex-col gap-4">
      <BaseAlert :tone="props.overview.staleCount === 0 ? 'success' : 'warning'">
        {{
          props.overview.staleCount === 0
            ? t('admin.storage.recover.ok', { hours: props.overview.thresholdHours })
            : t('admin.storage.recover.backlog', {
                count: props.overview.staleCount,
                hours: props.overview.thresholdHours,
              })
        }}
      </BaseAlert>

      <dl class="grid gap-4 text-body-sm sm:grid-cols-3">
        <div v-for="total in props.overview.totals" :key="total.status">
          <dt class="text-text-secondary">{{ t(`admin.storage.statuses.${total.status}`) }}</dt>
          <dd class="text-tabular font-semibold text-text-primary">
            {{ t('admin.storage.totals.objects', { count: total.count }) }}
          </dd>
          <dd class="text-caption text-text-muted">{{ formatFileSize(total.bytes) }}</dd>
        </div>
      </dl>

      <div>
        <BaseButton :disabled="sending" @click="recover">
          <RotateCw :size="16" aria-hidden="true" />
          {{ t('admin.storage.recover.submit') }}
        </BaseButton>
        <p class="mt-2 text-caption text-text-muted">
          {{ t('admin.storage.recover.hint', { hours: props.overview.thresholdHours }) }}
        </p>
      </div>
    </div>
  </BaseSection>
</template>
