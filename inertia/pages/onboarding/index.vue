<script setup lang="ts">
import { computed } from 'vue'
import { Head, useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseInput from '~/components/base_input.vue'
import BaseRadioGroup from '~/components/base_radio_group.vue'
import BaseButton from '~/components/base_button.vue'
import { ONBOARDING_TYPES, type OnboardingKind } from '#shared/types/organization'

const { t, locale } = useI18n()

const form = useForm({
  name: '',
  organizationType: null as OnboardingKind | null,
})

const typeOptions = computed(() =>
  ONBOARDING_TYPES.map((value) => ({
    value,
    label: t(`onboarding.type.${value}.label`),
    description: t(`onboarding.type.${value}.description`),
  }))
)

function submit() {
  form.post(urlFor('onboarding.store', { locale: locale.value }))
}
</script>

<template>
  <Head :title="t('onboarding.title')" />

  <div class="mx-auto flex max-w-[520px] flex-col justify-center">
    <div>
      <h1 class="mb-1.25 text-[32px] tracking-[-0.5px]">{{ t('onboarding.title') }}</h1>
      <p class="mb-12 text-lg text-[var(--gray-6)]">{{ t('onboarding.subtitle') }}</p>
    </div>

    <form class="flex flex-col gap-6" @submit.prevent="submit">
      <BaseInput
        id="name"
        v-model="form.name"
        type="text"
        :label="t('onboarding.fields.name')"
        :error="form.errors.name"
      />
      <BaseRadioGroup
        id="organizationType"
        v-model="form.organizationType"
        :options="typeOptions"
        :label="t('onboarding.fields.type')"
        :error="form.errors.organizationType"
      />
      <BaseButton type="submit" :disabled="form.processing">
        {{ t('onboarding.submit') }}
      </BaseButton>
    </form>
  </div>
</template>
