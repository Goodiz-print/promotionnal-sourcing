<script setup lang="ts">
import { provide } from 'vue'
import { Head, useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base_button.vue'
import OrganizationFormFields from '~/components/organization/form/organization_form_fields.vue'
import {
  OrganizationFormKey,
  type OrganizationFormState,
} from '~/components/organization/form/types'

const { t, locale } = useI18n()

const form = useForm<OrganizationFormState>({
  name: '',
  organizationType: null,
})

provide(OrganizationFormKey, form)

function submit() {
  form.post(urlFor('organization.store', { locale: locale.value }))
}
</script>

<template>
  <Head :title="t('organization.create.title')" />

  <div class="mx-auto flex max-w-[520px] flex-col justify-center p-7.5">
    <div>
      <h1 class="mb-1.25 text-[32px] tracking-[-0.5px]">{{ t('organization.create.title') }}</h1>
      <p class="mb-12 text-lg text-[var(--gray-6)]">{{ t('organization.create.subtitle') }}</p>
    </div>

    <form class="flex flex-col gap-6" @submit.prevent="submit">
      <OrganizationFormFields />
      <BaseButton type="submit" :disabled="form.processing">
        {{ t('organization.create.submit') }}
      </BaseButton>
    </form>
  </div>
</template>
