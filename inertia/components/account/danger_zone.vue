<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseDangerZone from '~/components/base/base_danger_zone.vue'
import BaseInput from '~/components/base/base_input.vue'

defineProps<{ blockingOrganizations: string[] }>()

const { t, locale } = useI18n()

const form = useForm({ currentPassword: '' })

/**
 * `window.confirm` : pattern du projet pour les actions destructives (cf. la
 * zone de danger de l'organisation).
 */
function destroy() {
  if (!window.confirm(t('account.danger.confirm'))) return

  form.delete(urlFor('account.destroy', { locale: locale.value }), { preserveScroll: true })
}
</script>

<template>
  <BaseDangerZone :title="t('account.danger.title')" :description="t('account.danger.subtitle')">
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-0.5">
        <p class="text-body-sm font-semibold text-text-primary">
          {{ t('account.danger.deleteTitle') }}
        </p>
        <p class="text-body-sm text-text-secondary">{{ t('account.danger.description') }}</p>
      </div>

      <BaseAlert v-if="blockingOrganizations.length > 0" tone="danger">
        {{ t('account.danger.blockedIntro', { names: blockingOrganizations.join(', ') }) }}
      </BaseAlert>
      <form v-else class="flex flex-col gap-4 sm:flex-row sm:items-end" @submit.prevent="destroy">
        <div class="w-full sm:max-w-[360px]">
          <BaseInput
            id="deleteCurrentPassword"
            v-model="form.currentPassword"
            type="password"
            autocomplete="current-password"
            :label="t('account.danger.confirmPassword')"
            :error="form.errors.currentPassword"
          />
        </div>
        <BaseButton type="submit" variant="danger" :loading="form.processing">
          {{ t('account.danger.submit') }}
        </BaseButton>
      </form>
    </div>
  </BaseDangerZone>
</template>
