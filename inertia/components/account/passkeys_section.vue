<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from '@inertiajs/vue3'
import { KeyRound, Plus } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { usePasskey } from '~/composables/use_passkey'
import { ICON_SIZE } from '~/types/ui'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSection from '~/components/base/base_section.vue'
import PasskeyItem from '~/components/account/passkey_item.vue'
import type { PasskeyType } from '#shared/types/passkey'

defineProps<{ passkeys: PasskeyType[] }>()

const { t, locale } = useI18n()
const { supported, register } = usePasskey()

const form = useForm({ name: t('account.passkeys.defaultName'), credential: '' })
const clientError = ref(false)

async function add() {
  clientError.value = false
  try {
    const credential = await register(urlFor('account.passkeys.options', { locale: locale.value }))
    if (!credential) return

    form.credential = credential
    form.post(urlFor('account.passkeys.store', { locale: locale.value }), {
      preserveScroll: true,
      onSuccess: () => form.reset('credential'),
    })
  } catch {
    clientError.value = true
  }
}
</script>

<template>
  <BaseSection :title="t('account.passkeys.title')" :description="t('account.passkeys.subtitle')">
    <ul v-if="passkeys.length > 0" class="flex flex-col">
      <PasskeyItem v-for="passkey in passkeys" :key="passkey.id" :passkey="passkey" />
    </ul>
    <BaseEmptyState v-else compact :icon="KeyRound" :title="t('account.passkeys.empty')" />

    <template #footer>
      <form v-if="supported" class="flex flex-col gap-4" @submit.prevent="add">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div class="grow">
            <BaseInput
              id="passkeyName"
              v-model="form.name"
              :label="t('account.passkeys.name')"
              :error="form.errors.name"
            />
          </div>
          <BaseButton type="submit" :loading="form.processing">
            <template #icon><Plus :size="ICON_SIZE" aria-hidden="true" /></template>
            {{ t('account.passkeys.add') }}
          </BaseButton>
        </div>
        <BaseAlert v-if="form.errors.credential || clientError" tone="danger">
          {{ form.errors.credential ?? t('account.passkeys.failed') }}
        </BaseAlert>
      </form>
      <p v-else class="text-body-sm text-text-secondary">{{ t('account.passkeys.unsupported') }}</p>
    </template>
  </BaseSection>
</template>
