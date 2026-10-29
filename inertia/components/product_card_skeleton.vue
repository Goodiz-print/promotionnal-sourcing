<script setup lang="ts">
import BaseCard from '~/components/base/base_card.vue'
import BaseSkeleton from '~/components/base/base_skeleton.vue'

/** Squelette d'une `ProductCard` : mêmes proportions (image carrée, nom, prix, MOQ, badge). */
</script>

<template>
  <BaseCard as="article" padding="sm" class="flex h-full flex-col gap-3" aria-hidden="true">
    <BaseSkeleton class="aspect-square w-full" />
    <div class="flex flex-1 flex-col gap-2">
      <BaseSkeleton class="h-4 w-4/5" />
      <BaseSkeleton class="h-4 w-1/3" />
      <BaseSkeleton class="h-3 w-1/2" />
    </div>
    <BaseSkeleton shape="pill" class="h-5 w-24" />
  </BaseCard>
</template>
