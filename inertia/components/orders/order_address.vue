<script setup lang="ts">
import { useI18n } from '~/i18n'
import type { OrderAddress } from '#shared/types/order'

/** Adresse figée sur la commande, avec son titre. */
defineProps<{ title: string; address: OrderAddress | null }>()

const { t } = useI18n()
</script>

<template>
  <section class="flex flex-col gap-1">
    <h3 class="font-medium">{{ title }}</h3>
    <address v-if="address" class="text-sm text-[var(--gray-8)] not-italic">
      <p>{{ address.name }}</p>
      <p v-if="address.line1">{{ address.line1 }}</p>
      <p v-if="address.line2">{{ address.line2 }}</p>
      <p>{{ [address.postalCode, address.city].filter(Boolean).join(' ') }}</p>
      <p>{{ address.country }}</p>
    </address>
    <p v-else class="text-sm text-[var(--gray-6)]">{{ t('order.show.noAddress') }}</p>
  </section>
</template>
