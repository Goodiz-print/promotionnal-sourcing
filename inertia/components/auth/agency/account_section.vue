<script setup lang="ts">
import { inject } from 'vue'
import { useI18n } from '~/i18n'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import { CIVILITIES } from '#shared/types/agency'
import { AgencySignupFormKey } from './types'

const form = inject(AgencySignupFormKey)!

const { t } = useI18n()
</script>

<template>
  <fieldset class="flex flex-col gap-6">
    <legend class="mb-1 text-heading-md">{{ t('agency_signup.sections.account') }}</legend>
    <BaseSelect
      id="civility"
      v-model="form.civility"
      :label="t('agency_signup.fields.civility')"
      :error="form.errors.civility"
    >
      <option value="">{{ t('agency_signup.civility.none') }}</option>
      <option v-for="civility in CIVILITIES" :key="civility" :value="civility">
        {{ t(`agency_signup.civility.${civility}`) }}
      </option>
    </BaseSelect>
    <BaseInput
      id="firstName"
      v-model="form.firstName"
      autocomplete="given-name"
      :label="t('auth.fields.firstName')"
      :error="form.errors.firstName"
    />
    <BaseInput
      id="lastName"
      v-model="form.lastName"
      autocomplete="family-name"
      :label="t('auth.fields.lastName')"
      :error="form.errors.lastName"
    />
    <BaseInput
      id="email"
      v-model="form.email"
      type="email"
      autocomplete="email"
      :label="t('agency_signup.fields.email')"
      :error="form.errors.email"
    />
    <BaseInput
      id="password"
      v-model="form.password"
      type="password"
      autocomplete="new-password"
      :label="t('auth.fields.password')"
      :error="form.errors.password"
    />
    <BaseInput
      id="passwordConfirmation"
      v-model="form.passwordConfirmation"
      type="password"
      autocomplete="new-password"
      :label="t('auth.fields.passwordConfirmation')"
      :error="form.errors.passwordConfirmation"
    />
  </fieldset>
</template>
