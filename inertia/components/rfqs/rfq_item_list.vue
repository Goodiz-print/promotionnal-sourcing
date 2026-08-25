<script setup lang="ts">
import { useI18n } from '~/i18n'
import type { RfqItemType } from '#shared/types/rfq'

/**
 * Lignes du besoin en lecture seule. Partagé par l'écran acheteur (demande
 * publiée, plus éditable) et l'écran fournisseur (jamais éditable) : les deux
 * affichent exactement le même besoin, seule la barre d'actions diffère.
 */
defineProps<{ items: RfqItemType[] }>()

const { t } = useI18n()
</script>

<template>
  <ul class="flex flex-col gap-2">
    <li v-for="item in items" :key="item.id" class="rounded border border-[var(--gray-3)] p-3">
      <div class="flex items-baseline justify-between gap-4">
        <p class="font-medium">{{ item.name }}</p>
        <span class="text-sm whitespace-nowrap text-[var(--gray-6)]">
          {{ item.quantity }} {{ item.unit }}
        </span>
      </div>
      <p v-if="item.description" class="mt-1 text-sm text-[var(--gray-6)]">
        {{ item.description }}
      </p>
      <p v-if="item.categoryName || item.productName" class="mt-1 text-sm text-[var(--gray-6)]">
        <span v-if="item.categoryName">
          {{ t('rfq.show.category') }} : {{ item.categoryName }}
        </span>
        <span v-if="item.productName">· {{ t('rfq.show.product') }} : {{ item.productName }}</span>
      </p>
    </li>
  </ul>
</template>
