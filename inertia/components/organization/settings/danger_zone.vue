<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base_button.vue'

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
  <section class="mt-12 rounded border border-[var(--state-danger)] p-6">
    <h2 class="mb-1.25 text-lg font-medium text-[var(--state-danger)]">
      {{ t('organization.danger.title') }}
    </h2>
    <p class="mb-6 text-sm text-[var(--gray-6)]">{{ t('organization.danger.subtitle') }}</p>

    <div class="flex flex-col gap-6">
      <div v-if="canLeave" class="flex items-start justify-between gap-6">
        <div>
          <p class="text-sm font-medium">{{ t('organization.leave.title') }}</p>
          <p class="text-sm text-[var(--gray-6)]">{{ t('organization.leave.description') }}</p>
        </div>
        <BaseButton variant="danger" @click="leave">{{
          t('organization.leave.submit')
        }}</BaseButton>
      </div>

      <div class="flex items-start justify-between gap-6">
        <div>
          <p class="text-sm font-medium">{{ t('organization.archive.title') }}</p>
          <p class="text-sm text-[var(--gray-6)]">{{ t('organization.archive.description') }}</p>
        </div>
        <BaseButton variant="danger" @click="archive">
          {{ t('organization.archive.submit') }}
        </BaseButton>
      </div>
    </div>
  </section>
</template>
