<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import { useRegionOptions } from '~/composables/use_region_options'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseTagPicker from '~/components/base/base_tag_picker.vue'
import type { CountryCode } from '#shared/types/country'
import type { Locale } from '#shared/types/i18n'
import type { SupplierContactType, SupplierTeamMemberOptionType } from '#shared/types/supplier'

/**
 * Ajout ou modification d'un contact commercial : coordonnées, langues, pays
 * couverts (aucun = tous les pays) et lien facultatif vers un membre du compte.
 */
const props = defineProps<{
  contact?: SupplierContactType
  members: SupplierTeamMemberOptionType[]
}>()

const emit = defineEmits<{ done: []; cancel: [] }>()

const { t, locale } = useI18n()
const { countryOptions, languageOptions } = useRegionOptions()

const form = useForm({
  name: props.contact?.name ?? '',
  jobTitle: props.contact?.jobTitle ?? '',
  email: props.contact?.email ?? '',
  phone: props.contact?.phone ?? '',
  languages: [...(props.contact?.languages ?? [])] as Locale[],
  countries: [...(props.contact?.countries ?? [])] as CountryCode[],
  userId: props.contact?.userId ?? null,
})

function submit() {
  const options = { preserveScroll: true, onSuccess: () => emit('done') }
  form.transform((data) => ({
    ...data,
    jobTitle: data.jobTitle.trim() || null,
    phone: data.phone.trim() || null,
  }))

  if (props.contact) {
    form.patch(
      urlFor('supplier.contacts.update', { locale: locale.value, id: props.contact.id }),
      options
    )
  } else {
    form.post(urlFor('supplier.contacts.store', { locale: locale.value }), options)
  }
}

const fieldId = (name: string) => `contact-${props.contact?.id ?? 'new'}-${name}`
</script>

<template>
  <form class="flex flex-col gap-5" @submit.prevent="submit">
    <div class="grid gap-5 sm:grid-cols-2">
      <BaseInput
        :id="fieldId('name')"
        v-model="form.name"
        required
        :label="t('supplier.contacts.fields.name')"
        :error="form.errors.name"
      />
      <BaseInput
        :id="fieldId('jobTitle')"
        v-model="form.jobTitle"
        :label="t('supplier.contacts.fields.jobTitle')"
        :error="form.errors.jobTitle"
      />
      <BaseInput
        :id="fieldId('email')"
        v-model="form.email"
        type="email"
        required
        :label="t('supplier.contacts.fields.email')"
        :error="form.errors.email"
      />
      <BaseInput
        :id="fieldId('phone')"
        v-model="form.phone"
        type="tel"
        :label="t('supplier.contacts.fields.phone')"
        :error="form.errors.phone"
      />
      <BaseTagPicker
        :id="fieldId('countries')"
        v-model="form.countries"
        :options="countryOptions"
        :label="t('supplier.contacts.fields.countries')"
        :hint="t('supplier.contacts.fields.countriesHint')"
        :placeholder="t('supplier.contacts.fields.addCountry')"
        :empty-label="t('supplier.contacts.allCountries')"
        :remove-label="(label) => t('supplier.contacts.remove', { label })"
        :error="form.errors.countries"
      />
      <BaseTagPicker
        :id="fieldId('languages')"
        v-model="form.languages"
        :options="languageOptions"
        :label="t('supplier.contacts.fields.languages')"
        :placeholder="t('supplier.contacts.fields.addLanguage')"
        :remove-label="(label) => t('supplier.contacts.remove', { label })"
        :error="form.errors.languages"
      />
      <BaseSelect
        :id="fieldId('userId')"
        v-model="form.userId"
        class="sm:col-span-2"
        :label="t('supplier.contacts.fields.member')"
        :hint="t('supplier.contacts.fields.memberHint')"
        :error="form.errors.userId"
      >
        <option :value="null">{{ t('supplier.contacts.fields.noMember') }}</option>
        <option v-for="member in members" :key="member.id" :value="member.id">
          {{ member.name }} ({{ member.email }})
        </option>
      </BaseSelect>
    </div>

    <div class="flex justify-end gap-3">
      <BaseButton variant="secondary" @click="emit('cancel')">
        {{ t('supplier.contacts.cancel') }}
      </BaseButton>
      <BaseButton type="submit" :loading="form.processing">
        {{ contact ? t('supplier.contacts.save') : t('supplier.contacts.add') }}
      </BaseButton>
    </div>
  </form>
</template>
