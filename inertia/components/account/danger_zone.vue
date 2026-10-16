<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseInput from '~/components/base/base_input.vue'
import BaseButton from '~/components/base/base_button.vue'

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
  <section class="rounded border border-[var(--state-danger)] p-6">
    <h2 class="mb-1.25 text-lg font-medium text-[var(--state-danger)]">
      {{ t('account.danger.title') }}
    </h2>
    <p class="mb-6 text-sm text-[var(--gray-6)]">{{ t('account.danger.subtitle') }}</p>

    <p class="text-sm font-medium">{{ t('account.danger.deleteTitle') }}</p>
    <p class="mb-4 text-sm text-[var(--gray-6)]">{{ t('account.danger.description') }}</p>

    <p v-if="blockingOrganizations.length > 0" class="text-sm text-[var(--state-danger)]">
      {{ t('account.danger.blockedIntro', { names: blockingOrganizations.join(', ') }) }}
    </p>
    <form v-else class="flex flex-col gap-4" @submit.prevent="destroy">
      <BaseInput
        id="deleteCurrentPassword"
        v-model="form.currentPassword"
        type="password"
        autocomplete="current-password"
        :label="t('account.danger.confirmPassword')"
        :error="form.errors.currentPassword"
      />
      <BaseButton type="submit" variant="danger" :disabled="form.processing">
        {{ t('account.danger.submit') }}
      </BaseButton>
    </form>
  </section>
</template>
