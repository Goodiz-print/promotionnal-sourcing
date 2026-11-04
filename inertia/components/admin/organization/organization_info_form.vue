<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'
import { ORGANIZATION_SIZES, type OrganizationSize } from '#shared/types/organization'
import type { AdminOrganizationDetail } from '#shared/types/admin_organization'

/**
 * Formulaire d'édition des informations d'une organisation (PATCH). Un champ vidé
 * est envoyé à `null` : le serveur l'efface ; nom et pays ne sont jamais effacés.
 */
const props = defineProps<{ organization: AdminOrganizationDetail }>()

const { t, locale } = useI18n()

const org = props.organization
const form = useForm({
  name: org.name,
  siret: org.siret ?? '',
  vatNumber: org.vatNumber ?? '',
  email: org.email ?? '',
  phone: org.phone ?? '',
  website: org.website ?? '',
  industry: org.industry ?? '',
  size: org.size as OrganizationSize | null,
  description: org.description ?? '',
  addressLine1: org.addressLine1 ?? '',
  addressLine2: org.addressLine2 ?? '',
  city: org.city ?? '',
  postalCode: org.postalCode ?? '',
  country: org.country,
})

const NULLABLE_TEXT = [
  'siret',
  'vatNumber',
  'email',
  'phone',
  'website',
  'industry',
  'description',
  'addressLine1',
  'addressLine2',
  'city',
  'postalCode',
] as const

const TEXT_FIELDS = [
  'name',
  'siret',
  'vatNumber',
  'email',
  'phone',
  'website',
  'industry',
  'addressLine1',
  'addressLine2',
  'city',
  'postalCode',
  'country',
] as const

function submit() {
  form
    .transform((data) => {
      const payload: Record<string, string | null> = {
        name: data.name.trim(),
        country: data.country.trim(),
        size: data.size,
      }
      for (const key of NULLABLE_TEXT) payload[key] = data[key].trim() || null
      return payload
    })
    .patch(urlFor('admin.organizations.update', { locale: locale.value, id: org.id }), {
      preserveScroll: true,
    })
}
</script>

<template>
  <form class="flex flex-col gap-5" @submit.prevent="submit">
    <div class="grid gap-5 sm:grid-cols-2">
      <BaseInput
        v-for="field in TEXT_FIELDS"
        :id="`org-${field}`"
        :key="field"
        v-model="form[field]"
        :label="t(`organization.fields.${field}`)"
        :error="form.errors[field]"
      />
      <BaseSelect
        id="org-size"
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
      id="org-description"
      v-model="form.description"
      :label="t('organization.fields.description')"
      :error="form.errors.description"
    />
    <div class="flex justify-end">
      <BaseButton type="submit" :loading="form.processing">
        {{ t('admin.organizations.detail.save') }}
      </BaseButton>
    </div>
  </form>
</template>
