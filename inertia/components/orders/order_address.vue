<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '~/i18n'
import BaseDescriptionList from '~/components/base/base_description_list.vue'
import BaseSection from '~/components/base/base_section.vue'
import type { OrderAddress } from '#shared/types/order'

/** Adresse figée sur la commande, avec son titre. */
const props = defineProps<{ title: string; address: OrderAddress | null }>()

const { t } = useI18n()

const items = computed(() => {
  const { address } = props
  if (!address) return []
  return [
    { label: t('order.address.name'), value: address.name },
    {
      label: t('order.address.street'),
      value: [address.line1, address.line2].filter(Boolean).join(', '),
    },
    {
      label: t('order.address.city'),
      value: [address.postalCode, address.city].filter(Boolean).join(' '),
    },
    { label: t('order.address.country'), value: address.country },
  ]
})
</script>

<template>
  <BaseSection :title="title">
    <BaseDescriptionList v-if="address" :items="items" :columns="1" />
    <p v-else class="text-body-sm text-text-muted">{{ t('order.show.noAddress') }}</p>
  </BaseSection>
</template>
