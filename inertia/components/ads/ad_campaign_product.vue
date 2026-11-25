<script setup lang="ts">
import { Image as ImageIcon } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import type { AdCampaignType } from '#shared/types/ads'

/**
 * Cellule « produit » d'une campagne : vignette, nom (slot par défaut pour le
 * lier) et ligne secondaire (slot `meta`). Signale un produit non publié, dont
 * la campagne ne diffuse pas.
 */
defineProps<{ campaign: AdCampaignType }>()

const { t } = useI18n()
</script>

<template>
  <div class="flex items-center gap-3">
    <img
      v-if="campaign.productImageUrl"
      :src="campaign.productImageUrl"
      alt=""
      class="size-10 shrink-0 rounded-md bg-sunken object-cover"
    />
    <span
      v-else
      class="flex size-10 shrink-0 items-center justify-center rounded-md bg-sunken text-text-muted"
      aria-hidden="true"
    >
      <ImageIcon :size="18" />
    </span>
    <div class="flex min-w-0 flex-col">
      <slot>
        <span class="truncate font-semibold text-text-primary">{{ campaign.productName }}</span>
      </slot>
      <span v-if="!campaign.productVisible" class="text-caption text-warning">
        {{ t('ads.index.productHidden') }}
      </span>
      <slot name="meta" />
    </div>
  </div>
</template>
