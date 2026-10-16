<script setup lang="ts">
import { inject } from 'vue'
import { useI18n } from '~/i18n'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'
import { ORGANIZATION_SIZES } from '#shared/types/organization'
import { OrganizationSettingsFormKey } from './types'

const form = inject(OrganizationSettingsFormKey)!

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <BaseInput
        id="name"
        v-model="form.name"
        :label="t('organization.fields.name')"
        :error="form.errors.name"
      />
      <BaseInput
        id="siret"
        v-model="form.siret"
        :label="t('organization.fields.siret')"
        :error="form.errors.siret"
      />
      <BaseInput
        id="vatNumber"
        v-model="form.vatNumber"
        :label="t('organization.fields.vatNumber')"
        :error="form.errors.vatNumber"
      />
      <BaseInput
        id="email"
        v-model="form.email"
        type="email"
        :label="t('organization.fields.email')"
        :error="form.errors.email"
      />
      <BaseInput
        id="phone"
        v-model="form.phone"
        :label="t('organization.fields.phone')"
        :error="form.errors.phone"
      />
      <BaseInput
        id="website"
        v-model="form.website"
        :label="t('organization.fields.website')"
        :error="form.errors.website"
      />
      <BaseInput
        id="industry"
        v-model="form.industry"
        :label="t('organization.fields.industry')"
        :error="form.errors.industry"
      />
      <BaseSelect
        id="size"
        v-model="form.size"
        :label="t('organization.fields.size')"
        :error="form.errors.size"
      >
        <option :value="null">{{ t('organization.size.none') }}</option>
        <option v-for="size in ORGANIZATION_SIZES" :key="size" :value="size">
          {{ t(`organization.size.${size}`) }}
        </option>
      </BaseSelect>
    </div>

    <BaseTextarea
      id="description"
      v-model="form.description"
      :label="t('organization.fields.description')"
      :error="form.errors.description"
    />
  </div>
</template>
