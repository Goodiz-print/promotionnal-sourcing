<script setup lang="ts">
import { inject } from 'vue'
import { useI18n } from '~/i18n'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import { AgencySignupFormKey } from './types'

const form = inject(AgencySignupFormKey)!

const { t } = useI18n()
</script>

<template>
  <fieldset class="flex flex-col gap-3">
    <legend class="mb-1 text-lg font-medium">{{ t('agency_signup.sections.consents') }}</legend>
    <div>
      <BaseCheckbox
        id="certifiesProfessional"
        v-model="form.certifiesProfessional"
        :label="t('agency_signup.consents.professional')"
      />
      <p v-if="form.errors.certifiesProfessional" class="mt-0.5 text-sm font-medium text-[#fb2c36]">
        {{ form.errors.certifiesProfessional }}
      </p>
    </div>
    <div>
      <BaseCheckbox
        id="acceptsTerms"
        v-model="form.acceptsTerms"
        :label="t('agency_signup.consents.terms')"
      />
      <p v-if="form.errors.acceptsTerms" class="mt-0.5 text-sm font-medium text-[#fb2c36]">
        {{ form.errors.acceptsTerms }}
      </p>
    </div>
    <BaseCheckbox
      id="acceptsPartnerCommunications"
      v-model="form.acceptsPartnerCommunications"
      :label="t('agency_signup.consents.partners')"
    />
  </fieldset>
</template>
