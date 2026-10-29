<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import { Archive, LogOut } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import BaseDangerZone from '~/components/base/base_danger_zone.vue'

const props = defineProps<{ organizationName: string; canLeave: boolean }>()

const { t, locale } = useI18n()

/**
 * `window.confirm` : c'est le pattern du projet pour les actions destructives
 * (retrait d'un membre, révocation d'invitation), aucun composant de modale
 * générique n'existe.
 */
function leave() {
  if (!window.confirm(t('organization.leave.confirm'))) return

  router.delete(urlFor('organization.leave', { locale: locale.value }), { preserveScroll: true })
}

function archive() {
  if (!window.confirm(t('organization.archive.confirm', { name: props.organizationName }))) return

  router.post(
    urlFor('organization.archive', { locale: locale.value }),
    {},
    { preserveScroll: true }
  )
}
</script>

<template>
  <BaseDangerZone
    :title="t('organization.danger.title')"
    :description="t('organization.danger.subtitle')"
  >
    <div v-if="canLeave" class="flex items-start justify-between gap-6">
      <div class="flex flex-col gap-0.5">
        <p class="text-body-sm font-semibold text-text-primary">
          {{ t('organization.leave.title') }}
        </p>
        <p class="text-body-sm text-text-secondary">{{ t('organization.leave.description') }}</p>
      </div>
      <BaseButton variant="danger" size="sm" @click="leave">
        <template #icon><LogOut :size="16" aria-hidden="true" /></template>
        {{ t('organization.leave.submit') }}
      </BaseButton>
    </div>

    <div class="flex items-start justify-between gap-6">
      <div class="flex flex-col gap-0.5">
        <p class="text-body-sm font-semibold text-text-primary">
          {{ t('organization.archive.title') }}
        </p>
        <p class="text-body-sm text-text-secondary">{{ t('organization.archive.description') }}</p>
      </div>
      <BaseButton variant="danger" size="sm" @click="archive">
        <template #icon><Archive :size="16" aria-hidden="true" /></template>
        {{ t('organization.archive.submit') }}
      </BaseButton>
    </div>
  </BaseDangerZone>
</template>
