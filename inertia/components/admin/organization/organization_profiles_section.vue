<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseDescriptionItem from '~/components/base/base_description_item.vue'
import BaseDescriptionList from '~/components/base/base_description_list.vue'
import BaseSection from '~/components/base/base_section.vue'
import type { AdminOrganizationDetail } from '#shared/types/admin_organization'

/**
 * Profils fournisseur, agence et facturation en lecture seule. Une section n'est
 * rendue que si le profil existe. Pour l'agence : motifs de revue et contrôles
 * automatiques (TVA via VIES, domaine de l'email).
 */
const props = defineProps<{ organization: AdminOrganizationDetail }>()

const { t, locale } = useI18n()

type Value = string | number | boolean | string[] | null | undefined

function text(value: Value): string | null {
  if (value === null || value === undefined) return null
  return Array.isArray(value) ? value.join(', ') || null : String(value)
}

function items(prefix: string, record: Record<string, Value>, keys: readonly string[]) {
  return keys.map((key) => ({
    label: t(`admin.organizations.detail.profile.${prefix}.${key}`),
    value: text(record[key]),
  }))
}

const SUPPLIER_KEYS = [
  'quoteEmail',
  'companyType',
  'commercialStatus',
  'minOrderQuantity',
  'deliveryDays',
  'responseTimeDays',
  'deliveryScope',
  'deliveryCountries',
  'spokenLanguages',
  'certifications',
  'reportFrequency',
  'catalogueUpdateMode',
  'catalogueUpdateFrequency',
  'defaultOriginScope',
  'bio',
] as const
const AGENCY_KEYS = [
  'activity',
  'activityOther',
  'teamSize',
  'purchaseVolume',
  'clientSectors',
  'defaultMarginPercent',
] as const
const BILLING_KEYS = [
  'email',
  'addressLine1',
  'addressLine2',
  'city',
  'postalCode',
  'country',
  'purchaseOrderReference',
] as const

const supplierItems = computed(() => {
  const profile = props.organization.supplierProfile
  return profile ? items('supplier', profile, SUPPLIER_KEYS) : []
})
const agencyItems = computed(() => {
  const profile = props.organization.agencyProfile
  return profile ? items('agency', profile, AGENCY_KEYS) : []
})
const billingItems = computed(() => {
  const profile = props.organization.billingProfile
  return profile ? items('billing', profile, BILLING_KEYS) : []
})

const formatDate = (value: string) => new Date(value).toLocaleDateString(locale.value)
</script>

<template>
  <BaseSection
    v-if="organization.supplierProfile"
    :title="t('admin.organizations.detail.profile.supplier.title')"
  >
    <BaseDescriptionList :items="supplierItems">
      <BaseDescriptionItem
        :label="t('admin.organizations.detail.profile.supplier.foundingPartner')"
      >
        {{
          organization.supplierProfile.isFoundingPartner
            ? t('admin.organizations.detail.profile.yes')
            : t('admin.organizations.detail.profile.no')
        }}
      </BaseDescriptionItem>
    </BaseDescriptionList>
  </BaseSection>

  <BaseSection
    v-if="organization.agencyProfile"
    :title="t('admin.organizations.detail.profile.agency.title')"
  >
    <BaseDescriptionList :items="agencyItems">
      <BaseDescriptionItem
        :label="t('admin.organizations.detail.profile.agency.reviewReasons')"
        full
      >
        <div v-if="organization.reviewReasons?.length" class="flex flex-wrap gap-2">
          <BaseBadge v-for="reason in organization.reviewReasons" :key="reason" tone="warning">
            {{ t(`admin.agencyReviews.reasons.${reason}`) }}
          </BaseBadge>
        </div>
        <span v-else class="text-text-muted">
          {{ t('admin.organizations.detail.profile.agency.noReasons') }}
        </span>
      </BaseDescriptionItem>
      <BaseDescriptionItem :label="t('admin.agencyReviews.columns.vat')">
        <BaseBadge dot :tone="organization.vatVerifiedAt ? 'success' : 'neutral'">
          {{
            organization.vatVerifiedAt
              ? `${t('admin.agencyReviews.verified')} · ${formatDate(organization.vatVerifiedAt)}`
              : t('admin.agencyReviews.notVerified')
          }}
        </BaseBadge>
      </BaseDescriptionItem>
      <BaseDescriptionItem :label="t('admin.agencyReviews.columns.domain')">
        <BaseBadge dot :tone="organization.domainVerifiedAt ? 'success' : 'neutral'">
          {{
            organization.domainVerifiedAt
              ? `${t('admin.agencyReviews.verified')} · ${formatDate(organization.domainVerifiedAt)}`
              : t('admin.agencyReviews.notVerified')
          }}
        </BaseBadge>
      </BaseDescriptionItem>
    </BaseDescriptionList>
  </BaseSection>

  <BaseSection
    v-if="organization.billingProfile"
    :title="t('admin.organizations.detail.profile.billing.title')"
  >
    <BaseDescriptionList :items="billingItems" />
  </BaseSection>
</template>
