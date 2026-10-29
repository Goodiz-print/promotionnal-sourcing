<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { usePasskey } from '~/composables/use_passkey'
import BaseButton from '~/components/base/base_button.vue'

const props = defineProps<{ redirect?: string | null }>()

const { t, locale } = useI18n()
const { supported, authenticate } = usePasskey()

const form = useForm({ credential: '' })
const clientError = ref(false)

async function login() {
  clientError.value = false
  try {
    const credential = await authenticate(urlFor('passkey.login.options', { locale: locale.value }))
    if (!credential) return

    form.credential = credential
    const target = urlFor('passkey.login', { locale: locale.value })
    form.post(props.redirect ? `${target}?redirect=${encodeURIComponent(props.redirect)}` : target)
  } catch {
    clientError.value = true
  }
}
</script>

<template>
  <div v-if="supported" class="flex flex-col gap-2">
    <BaseButton variant="secondary" block :loading="form.processing" @click="login">
      {{ t('auth.passkey.login') }}
    </BaseButton>
    <p v-if="form.errors.credential || clientError" class="text-caption font-medium text-danger">
      {{ form.errors.credential ?? t('auth.passkey.failed') }}
    </p>
  </div>
</template>
