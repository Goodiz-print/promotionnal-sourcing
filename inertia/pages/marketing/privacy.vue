<script setup lang="ts">
import LegalDocument from '~/components/marketing/legal_document.vue'
import MarketingHead from '~/components/marketing/marketing_head.vue'
import { useMarketing } from '~/composables/use_marketing'
import MarketingLayout from '~/layouts/marketing.vue'

defineOptions({ layout: MarketingLayout })
defineProps<{ siteUrl: string }>()

const { t } = useMarketing()

const SECTION_IDS = [
  'responsable',
  'donnees-collectees',
  'finalites',
  'destinataires',
  'conservation',
  'cookies',
  'securite',
  'vos-droits',
  'reclamation',
  'modification',
] as const
</script>

<template>
  <MarketingHead
    :title="t('privacy.seoTitle')"
    :description="t('privacy.seoDescription')"
    :site-url="siteUrl"
  />
  <LegalDocument doc="privacy" :section-ids="SECTION_IDS" />
</template>
