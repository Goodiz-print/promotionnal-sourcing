<script setup lang="ts">
import { provide } from 'vue'
import { Head, useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import SectionNav from '~/components/organization/section_nav.vue'
import GeneralFields from '~/components/organization/settings/general_fields.vue'
import AddressFields from '~/components/organization/settings/address_fields.vue'
import LogoField from '~/components/organization/settings/logo_field.vue'
import DangerZone from '~/components/organization/settings/danger_zone.vue'
import {
  OrganizationSettingsFormKey,
  type OrganizationSettingsFormState,
} from '~/components/organization/settings/types'
import type { OrganizationType } from '#shared/types/organization'

const props = defineProps<{ organization: OrganizationType; canLeave: boolean }>()

const { t, locale } = useI18n()

const form = useForm<OrganizationSettingsFormState>({
  name: props.organization.name,
  siret: props.organization.siret ?? '',
  vatNumber: props.organization.vatNumber ?? '',
  email: props.organization.email ?? '',
  phone: props.organization.phone ?? '',
  website: props.organization.website ?? '',
  industry: props.organization.industry ?? '',
  size: props.organization.size,
  description: props.organization.description ?? '',
  addressLine1: props.organization.addressLine1 ?? '',
  addressLine2: props.organization.addressLine2 ?? '',
  city: props.organization.city ?? '',
  postalCode: props.organization.postalCode ?? '',
  country: props.organization.country,
  logo: null,
  removeLogo: false,
})

provide(OrganizationSettingsFormKey, form)

function submit() {
  form
    .transform((data) => {
      const payload: Record<string, unknown> = {
        name: data.name,
        country: data.country,
        removeLogo: data.removeLogo,
      }
      if (data.siret) payload.siret = data.siret
      if (data.vatNumber) payload.vatNumber = data.vatNumber
      if (data.email) payload.email = data.email
      if (data.phone) payload.phone = data.phone
      if (data.website) payload.website = data.website
      if (data.industry) payload.industry = data.industry
      if (data.size) payload.size = data.size
      if (data.description) payload.description = data.description
      if (data.addressLine1) payload.addressLine1 = data.addressLine1
      if (data.addressLine2) payload.addressLine2 = data.addressLine2
      if (data.city) payload.city = data.city
      if (data.postalCode) payload.postalCode = data.postalCode
      if (data.logo) payload.logo = data.logo
      return payload
    })
    .post(urlFor('organization.settings.update', { locale: locale.value }), {
      forceFormData: true,
      preserveScroll: true,
      onSuccess: () => {
        // Le champ fichier et la case "supprimer" sont transitoires : la
        // page ré-affiche les props fraîches (logoUrl à jour) sans
        // remonter le composant, donc on les remet à zéro nous-mêmes.
        form.logo = null
        form.removeLogo = false
      },
    })
}
</script>

<template>
  <Head :title="t('organization.settings.title')" />

  <div class="mx-auto flex max-w-[720px] flex-col justify-center px-6 py-12">
    <SectionNav current="settings" />

    <div>
      <h1 class="mb-1.25 text-[32px] tracking-[-0.5px]">{{ t('organization.settings.title') }}</h1>
      <p class="mb-8 text-lg text-[var(--gray-6)]">{{ t('organization.settings.subtitle') }}</p>
    </div>

    <form class="flex flex-col gap-8" @submit.prevent="submit">
      <LogoField :current-logo-url="organization.logoUrl" />
      <GeneralFields />
      <AddressFields />

      <BaseButton type="submit" :disabled="form.processing">
        {{ t('organization.settings.submit') }}
      </BaseButton>
    </form>

    <DangerZone :organization-name="organization.name" :can-leave="canLeave" />
  </div>
</template>
