<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { Form } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import AuthHeader from '~/components/auth/auth_header.vue'
import AuthLayout from '~/layouts/auth.vue'
import BaseButton from '~/components/base/base_button.vue'

defineProps<{ email: string }>()

defineOptions({ layout: AuthLayout })

const { t, locale } = useI18n()
</script>

<template>
  <Head :title="t('auth.verify.title')" />

  <div class="flex flex-col gap-8">
    <AuthHeader
      :title="t('auth.verify.title')"
      :description="t('auth.verify.description', { email })"
    >
      <p class="text-caption text-text-muted">{{ t('auth.verify.hint') }}</p>
    </AuthHeader>

    <Form v-slot="{ processing }" route="email.verification.resend" :params="{ locale }">
      <BaseButton type="submit" block :loading="processing">
        {{ t('auth.verify.resend') }}
      </BaseButton>
    </Form>
  </div>
</template>
