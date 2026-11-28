<script setup lang="ts">
import { computed, inject, watch } from 'vue'
import { useI18n } from '~/i18n'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import CountrySelect from '~/components/country_select.vue'
import { AGENCY_ACTIVITIES } from '#shared/types/agency'
import { defaultLocaleForCountry } from '#shared/types/country'
import { SUPPORTED_LOCALES } from '#shared/types/i18n'
import { AgencySignupFormKey } from './types'

const form = inject(AgencySignupFormKey)!

const { t, locale } = useI18n()

// Noms de langues dans la langue de la page, sans table de traduction.
const languageNames = computed(() => new Intl.DisplayNames([locale.value], { type: 'language' }))

// La langue est déduite du pays tant que l'utilisateur ne l'a pas choisie lui-même.
let localeTouched = false
watch(
  () => form.country,
  (country) => {
    if (!localeTouched && country) form.locale = defaultLocaleForCountry(country)
  }
)

function pickLocale(value: string) {
  localeTouched = true
  form.locale = value as typeof form.locale
}
</script>

<template>
  <fieldset class="flex flex-col gap-6">
    <legend class="mb-1 text-heading-md">{{ t('agency_signup.sections.company') }}</legend>
    <BaseInput
      id="companyName"
      v-model="form.companyName"
      autocomplete="organization"
      :label="t('agency_signup.fields.companyName')"
      :error="form.errors.companyName"
    />
    <CountrySelect
      id="country"
      :model-value="form.country"
      :label="t('agency_signup.fields.country')"
      :error="form.errors.country"
      @update:model-value="form.country = $event ?? ''"
    />
    <div>
      <BaseInput
        id="taxId"
        v-model="form.taxId"
        autocomplete="off"
        placeholder="FR12345678901"
        :label="t('agency_signup.fields.taxId')"
        :error="form.errors.taxId"
      />
      <p class="text-caption text-text-muted">{{ t('agency_signup.taxIdHelp') }}</p>
    </div>
    <div>
      <BaseInput
        id="website"
        v-model="form.website"
        type="url"
        autocomplete="url"
        placeholder="https://agence.fr"
        :label="t('agency_signup.fields.website')"
        :error="form.errors.website"
      />
      <p class="text-caption text-text-muted">{{ t('agency_signup.websiteHelp') }}</p>
    </div>
    <BaseInput
      id="phone"
      v-model="form.phone"
      type="tel"
      autocomplete="tel"
      :label="t('agency_signup.fields.phone')"
      :error="form.errors.phone"
    />
    <BaseInput
      id="contactEmail"
      v-model="form.contactEmail"
      type="email"
      autocomplete="email"
      :label="t('agency_signup.fields.contactEmail')"
      :hint="t('agency_signup.contactEmailHelp')"
      :error="form.errors.contactEmail"
    />
    <BaseSelect
      id="activity"
      v-model="form.activity"
      :label="t('agency_signup.fields.activity')"
      :error="form.errors.activity"
    >
      <option value="" disabled>{{ t('agency_signup.activity.placeholder') }}</option>
      <option v-for="activity in AGENCY_ACTIVITIES" :key="activity" :value="activity">
        {{ t(`agency_signup.activity.${activity}`) }}
      </option>
    </BaseSelect>
    <BaseInput
      v-if="form.activity === 'other'"
      id="activityOther"
      v-model="form.activityOther"
      :label="t('agency_signup.fields.activityOther')"
      :error="form.errors.activityOther"
    />
    <BaseSelect
      id="locale"
      :model-value="form.locale"
      :label="t('agency_signup.fields.locale')"
      :error="form.errors.locale"
      @update:model-value="pickLocale"
    >
      <option v-for="code in SUPPORTED_LOCALES" :key="code" :value="code">
        {{ languageNames.of(code) ?? code }}
      </option>
    </BaseSelect>
  </fieldset>
</template>
