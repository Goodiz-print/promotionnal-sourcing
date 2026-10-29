<script setup lang="ts">
import { provide } from 'vue'
import { Head, useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import AuthHeader from '~/components/auth/auth_header.vue'
import AuthLayout from '~/layouts/auth.vue'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import OrganizationFormFields from '~/components/organization/form/organization_form_fields.vue'
import {
  OrganizationFormKey,
  type OrganizationFormState,
} from '~/components/organization/form/types'

defineOptions({ layout: AuthLayout })

const { t, locale } = useI18n()

const form = useForm<OrganizationFormState>({
  name: '',
  organizationType: null,
})

provide(OrganizationFormKey, form)

function submit() {
  form.post(urlFor('onboarding.store', { locale: locale.value }))
}
</script>

<template>
  <Head :title="t('onboarding.title')" />

  <div class="flex flex-col gap-8">
    <AuthHeader :title="t('onboarding.title')" :description="t('onboarding.subtitle')" />

    <form class="flex flex-col gap-6" @submit.prevent="submit">
      <OrganizationFormFields />
      <BaseButton type="submit" block :loading="form.processing">
        {{ t('onboarding.submit') }}
      </BaseButton>
    </form>
  </div>
</template>
