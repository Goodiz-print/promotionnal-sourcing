<script setup lang="ts">
import { inject } from 'vue'
import { useI18n } from '~/i18n'
import BaseInput from '~/components/base/base_input.vue'
import CountrySelect from '~/components/country_select.vue'
import { OrganizationSettingsFormKey } from './types'

const form = inject(OrganizationSettingsFormKey)!

const { t } = useI18n()
</script>

<template>
  <div class="grid gap-5 sm:grid-cols-2">
    <BaseInput
      id="addressLine1"
      v-model="form.addressLine1"
      class="sm:col-span-2"
      :label="t('organization.fields.addressLine1')"
      :error="form.errors.addressLine1"
    />
    <BaseInput
      id="addressLine2"
      v-model="form.addressLine2"
      class="sm:col-span-2"
      :label="t('organization.fields.addressLine2')"
      :error="form.errors.addressLine2"
    />
    <BaseInput
      id="postalCode"
      v-model="form.postalCode"
      :label="t('organization.fields.postalCode')"
      :error="form.errors.postalCode"
    />
    <BaseInput
      id="city"
      v-model="form.city"
      :label="t('organization.fields.city')"
      :error="form.errors.city"
    />
    <CountrySelect
      id="country"
      :model-value="form.country"
      :label="t('organization.fields.country')"
      :error="form.errors.country"
      @update:model-value="form.country = $event ?? ''"
    />
  </div>
</template>
