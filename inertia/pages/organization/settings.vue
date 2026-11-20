<script setup lang="ts">
import { provide } from 'vue'
import { Head, useForm } from '@inertiajs/vue3'
import { Plus } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useOrganizationTabs } from '~/composables/use_organization_tabs'
import BaseButton from '~/components/base/base_button.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTabs from '~/components/base/base_tabs.vue'
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
const { items: tabs, label: tabsLabel, createHref, createLabel } = useOrganizationTabs()

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

  <div class="flex w-full flex-col gap-8">
    <BasePageHeader
      :title="t('organization.settings.title')"
      :description="t('organization.settings.subtitle')"
    />

    <BaseTabs :items="tabs" :label="tabsLabel">
      <template #actions>
        <BaseLinkButton :href="createHref" variant="ghost" size="sm">
          <Plus :size="16" aria-hidden="true" />
          {{ createLabel }}
        </BaseLinkButton>
      </template>
    </BaseTabs>

    <form class="flex flex-col gap-6" @submit.prevent="submit">
      <BaseSection as="fieldset" :title="t('organization.fields.logo')">
        <LogoField :current-logo-url="organization.logoUrl" />
      </BaseSection>

      <BaseSection as="fieldset" :title="t('organization.settings.sections.general')">
        <GeneralFields :is-buyer="organization.organizationType === 'buyer'" />
      </BaseSection>

      <BaseSection as="fieldset" :title="t('organization.settings.sections.address')">
        <AddressFields />
      </BaseSection>

      <div class="flex justify-end">
        <BaseButton type="submit" :loading="form.processing">
          {{ t('organization.settings.submit') }}
        </BaseButton>
      </div>
    </form>

    <DangerZone :organization-name="organization.name" :can-leave="canLeave" />
  </div>
</template>
