<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '~/i18n'
import BaseDescriptionList from '~/components/base/base_description_list.vue'
import BaseSection from '~/components/base/base_section.vue'
import type { AdminOrganizationDetail } from '#shared/types/admin_organization'
import { formatShortDate } from '#shared/helpers/date'

/**
 * Synthèse en lecture seule : identité, dates, plan. Les coordonnées n'y figurent
 * que sans droit de gestion (sinon le formulaire d'édition les porte).
 */
const props = defineProps<{ organization: AdminOrganizationDetail; canManage: boolean }>()

const { t, locale } = useI18n()

const formatDate = (value: string) => formatShortDate(value, locale.value)

const items = computed(() => {
  const org = props.organization
  const contact = props.canManage
    ? []
    : (['email', 'phone', 'website', 'siret', 'vatNumber'] as const).map((field) => ({
        label: t(`admin.organizations.fields.${field}`),
        value: org[field],
      }))
  return [
    { label: t('admin.organizations.detail.slug'), value: org.slug },
    ...contact,
    { label: t('admin.organizations.fields.country'), value: org.country },
    { label: t('admin.organizations.detail.plan'), value: org.subscriptionPlan },
    { label: t('admin.organizations.detail.locale'), value: org.locale },
    { label: t('admin.organizations.fields.createdAt'), value: formatDate(org.createdAt) },
    {
      label: t('admin.organizations.columns.lastActivity'),
      value: org.lastActivity ? formatDate(org.lastActivity) : t('admin.users.show.never'),
    },
  ]
})
</script>

<template>
  <BaseSection :title="t('admin.organizations.detail.overview')">
    <BaseDescriptionList :items="items" />
  </BaseSection>
</template>
