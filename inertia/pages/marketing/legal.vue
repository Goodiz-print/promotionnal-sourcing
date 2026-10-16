<script setup lang="ts">
import LegalDocument from '~/components/marketing/legal_document.vue'
import MarketingHead from '~/components/marketing/marketing_head.vue'
import { useMarketing } from '~/composables/use_marketing'
import MarketingLayout from '~/layouts/marketing.vue'

defineOptions({ layout: MarketingLayout })
defineProps<{ siteUrl: string }>()

const { t } = useMarketing()

const SECTION_IDS = [
  'editeur',
  'siege',
  'immatriculation',
  'tva',
  'activite',
  'hebergeur',
  'contact',
  'propriete-intellectuelle',
  'donnees-personnelles',
] as const
</script>

<template>
  <MarketingHead
    :title="t('legal.seoTitle')"
    :description="t('legal.seoDescription')"
    :site-url="siteUrl"
  />
  <LegalDocument doc="legal" :section-ids="SECTION_IDS" />
</template>
