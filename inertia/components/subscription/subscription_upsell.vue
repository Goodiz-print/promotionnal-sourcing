<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import type { SubscriptionUpsellType } from '#shared/types/subscription'

/**
 * Encart « abonnez-vous » des écrans « Demandes reçues » d'un fournisseur non
 * abonné (#222), à la place du bloc agence masqué (#220). Seul un propriétaire
 * ou un administrateur peut souscrire : les autres sont invités à passer par
 * lui.
 */
const props = defineProps<{ upsell: SubscriptionUpsellType }>()

const { t, locale } = useI18n()

const subscribeUrl = computed(() => urlFor('supplier.subscription.show', { locale: locale.value }))
const body = computed(() =>
  props.upsell.canSubscribe ? t('subscription.upsell.body') : t('subscription.upsell.askAdmin')
)
</script>

<template>
  <BaseAlert tone="info" :title="t('subscription.upsell.title')">
    <div class="flex flex-col items-start gap-3">
      <p>{{ body }}</p>
      <BaseLinkButton v-if="upsell.canSubscribe" :href="subscribeUrl" size="sm">
        {{ t('subscription.upsell.cta') }}
      </BaseLinkButton>
    </div>
  </BaseAlert>
</template>
