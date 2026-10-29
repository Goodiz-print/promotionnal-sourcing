<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { Form } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import AuthLayout from '~/layouts/auth.vue'
import BaseButton from '~/components/base/base_button.vue'

defineProps<{ email: string }>()

defineOptions({ layout: AuthLayout })

const { t, locale } = useI18n()
</script>

<template>
  <Head :title="t('auth.verify.title')" />

  <div class="flex flex-col gap-8">
    <div class="flex flex-col gap-2">
      <h1 class="text-display-md">{{ t('auth.verify.title') }}</h1>
      <p class="text-body-md text-text-secondary">
        {{ t('auth.verify.description', { email }) }}
      </p>
      <p class="text-caption text-text-muted">{{ t('auth.verify.hint') }}</p>
    </div>

    <Form v-slot="{ processing }" route="email.verification.resend" :params="{ locale }">
      <BaseButton type="submit" block :loading="processing">
        {{ t('auth.verify.resend') }}
      </BaseButton>
    </Form>
  </div>
</template>
