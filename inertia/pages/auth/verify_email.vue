<script setup lang="ts">
import { Form } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import BaseButton from '~/components/base/base_button.vue'

defineProps<{ email: string }>()

const { t, locale } = useI18n()
</script>

<template>
  <div class="mx-auto flex max-w-[400px] flex-col justify-center">
    <div>
      <h1 class="mb-1.25 text-[32px] tracking-[-0.5px]">{{ t('auth.verify.title') }}</h1>
      <p class="mb-4 text-lg text-[var(--gray-6)]">
        {{ t('auth.verify.description', { email }) }}
      </p>
      <p class="mb-12 text-sm text-[var(--gray-6)]">{{ t('auth.verify.hint') }}</p>
    </div>

    <Form v-slot="{ processing }" route="email.verification.resend" :params="{ locale }">
      <BaseButton type="submit" :disabled="processing">
        {{ t('auth.verify.resend') }}
      </BaseButton>
    </Form>
  </div>
</template>
