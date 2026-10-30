<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'
import { useMarketing } from '~/composables/use_marketing'
import { CONTACT_HONEYPOT_FIELD, type ContactRequestType } from '#shared/types/marketing'

const props = defineProps<{ initialType: ContactRequestType }>()

const { t, locale } = useMarketing()

const form = useForm({
  type: props.initialType,
  name: '',
  company: '',
  email: '',
  phone: '',
  message: '',
  [CONTACT_HONEYPOT_FIELD]: '',
})

function submit() {
  form.post(urlFor('marketing.contact.store', { locale: locale.value }))
}
</script>

<template>
  <form class="mx-auto w-full max-w-[620px] text-left" @submit.prevent="submit">
    <!-- Piège à bots : masqué et retiré de l'ordre de tabulation. -->
    <p class="hidden" aria-hidden="true">
      <label>
        {{ t('landing.contact.honeypot') }}
        <input
          v-model="form[CONTACT_HONEYPOT_FIELD]"
          type="text"
          tabindex="-1"
          autocomplete="off"
        />
      </label>
    </p>

    <div class="grid gap-4 sm:grid-cols-2">
      <BaseInput
        id="contact-name"
        v-model="form.name"
        :label="t('landing.contact.fieldName')"
        :error="form.errors.name"
        autocomplete="name"
        required
      />
      <BaseInput
        id="contact-company"
        v-model="form.company"
        :label="t('landing.contact.fieldCompany')"
        :error="form.errors.company"
        autocomplete="organization"
        required
      />
      <BaseInput
        id="contact-email"
        v-model="form.email"
        type="email"
        :label="t('landing.contact.fieldEmail')"
        :error="form.errors.email"
        autocomplete="email"
        required
      />
      <BaseInput
        id="contact-phone"
        v-model="form.phone"
        type="tel"
        :label="`${t('landing.contact.fieldPhone')} (${t('landing.contact.fieldPhoneOptional')})`"
        :error="form.errors.phone"
        autocomplete="tel"
      />
      <BaseSelect
        id="contact-type"
        v-model="form.type"
        class="sm:col-span-2"
        :label="t('landing.contact.fieldType')"
        :error="form.errors.type"
        required
      >
        <option value="contact">{{ t('landing.contact.fieldTypeContact') }}</option>
        <option value="partnership">{{ t('landing.contact.fieldTypePartnership') }}</option>
      </BaseSelect>
      <BaseTextarea
        id="contact-message"
        v-model="form.message"
        class="sm:col-span-2"
        :label="t('landing.contact.fieldMessage')"
        :placeholder="t('landing.contact.fieldMessagePlaceholder')"
        :error="form.errors.message"
        :rows="5"
        required
      />
    </div>

    <p class="mt-3 text-caption text-text-muted">{{ t('landing.contact.requiredHint') }}</p>

    <div class="mt-6 flex flex-wrap items-center justify-center gap-4 sm:justify-start">
      <BaseButton type="submit" :loading="form.processing">
        {{ t('landing.contact.submit') }}
      </BaseButton>
      <p class="max-w-[320px] text-caption text-text-muted">
        {{ t('landing.contact.privacyBefore')
        }}<Link
          class="text-text-brand underline underline-offset-2"
          route="marketing.privacy"
          :params="{ locale }"
          >{{ t('landing.contact.privacyLink') }}</Link
        >{{ t('landing.contact.privacyAfter') }}
      </p>
    </div>
  </form>
</template>
