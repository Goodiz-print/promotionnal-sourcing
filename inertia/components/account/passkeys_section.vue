<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { usePasskey } from '~/composables/use_passkey'
import BaseInput from '~/components/base_input.vue'
import BaseButton from '~/components/base_button.vue'
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
  <section>
    <h2 class="mb-1.25 text-lg font-medium">{{ t('account.passkeys.title') }}</h2>
    <p class="mb-4 text-sm text-[var(--gray-6)]">{{ t('account.passkeys.subtitle') }}</p>

    <ul v-if="passkeys.length > 0" class="mb-6 flex flex-col gap-3">
      <PasskeyItem v-for="passkey in passkeys" :key="passkey.id" :passkey="passkey" />
    </ul>
    <p v-else class="mb-6 text-sm text-[var(--gray-6)]">{{ t('account.passkeys.empty') }}</p>

    <form v-if="supported" class="flex flex-col gap-4" @submit.prevent="add">
      <BaseInput
        id="passkeyName"
        v-model="form.name"
        :label="t('account.passkeys.name')"
        :error="form.errors.name"
      />
      <p v-if="form.errors.credential || clientError" class="text-sm text-[var(--state-danger)]">
        {{ form.errors.credential ?? t('account.passkeys.failed') }}
      </p>
      <BaseButton type="submit" :disabled="form.processing">
        {{ t('account.passkeys.add') }}
      </BaseButton>
    </form>
    <p v-else class="text-sm text-[var(--gray-6)]">{{ t('account.passkeys.unsupported') }}</p>
  </section>
</template>
