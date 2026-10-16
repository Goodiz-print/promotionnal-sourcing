<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from '~/i18n'
import BaseInput from '~/components/base/base_input.vue'
import BaseRadioGroup from '~/components/base/base_radio_group.vue'
import { ONBOARDING_TYPES } from '#shared/types/organization'
import { OrganizationFormKey } from './types'

const form = inject(OrganizationFormKey)!

const { t } = useI18n()

const typeOptions = computed(() =>
  ONBOARDING_TYPES.map((value) => ({
    value,
    label: t(`onboarding.type.${value}.label`),
    description: t(`onboarding.type.${value}.description`),
  }))
)
</script>

<template>
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
</template>
