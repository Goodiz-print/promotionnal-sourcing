<script setup lang="ts">
import { computed } from 'vue'
import LegalDocument from '~/components/marketing/legal_document.vue'
import MarketingHead from '~/components/marketing/marketing_head.vue'
import { useMarketing } from '~/composables/use_marketing'
import MarketingLayout from '~/layouts/marketing.vue'
import { PRIVACY_PROCESSOR_BODY_KEYS, type LlmProvider } from '#shared/types/ai'

defineOptions({ layout: MarketingLayout })
const props = defineProps<{ siteUrl: string; aiProcessor: LlmProvider }>()

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

/* Le sous-traitant IA cité dépend du fournisseur configuré (Mistral ou Claude). */
const bodyKeys = computed(() => ({
  destinataires: PRIVACY_PROCESSOR_BODY_KEYS[props.aiProcessor],
}))
</script>

<template>
  <MarketingHead
    :title="t('privacy.seoTitle')"
    :description="t('privacy.seoDescription')"
    :site-url="siteUrl"
  />
  <LegalDocument doc="privacy" :section-ids="SECTION_IDS" :body-keys="bodyKeys" />
</template>
