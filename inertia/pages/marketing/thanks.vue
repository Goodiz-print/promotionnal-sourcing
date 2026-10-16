<script setup lang="ts">
import BaseLinkButton from '~/components/base/base_link_button.vue'
import MarketingHead from '~/components/marketing/marketing_head.vue'
import { useMarketing } from '~/composables/use_marketing'
import MarketingLayout from '~/layouts/marketing.vue'

defineOptions({ layout: MarketingLayout })
defineProps<{ siteUrl: string }>()

const { t, path, email } = useMarketing()
</script>

<template>
  <MarketingHead
    :title="t('landing.thanks.seoTitle')"
    :description="t('landing.thanks.seoDescription')"
    :site-url="siteUrl"
    noindex
  />
  <section class="wrapper flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
    <span
      class="mb-7 inline-flex h-14 w-14 items-center justify-center rounded-pill bg-success-bg text-success"
      aria-hidden="true"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>
    <p class="mb-3 text-eyebrow text-text-brand">{{ t('landing.thanks.eyebrow') }}</p>
    <h1 class="mb-4 max-w-[560px] text-display-lg">{{ t('landing.thanks.heading') }}</h1>
    <p class="mb-9 max-w-[520px] text-body-lg text-text-secondary">
      {{ t('landing.thanks.body') }}
      <a class="text-text-brand underline underline-offset-2" :href="`mailto:${email}`">{{
        email
      }}</a
      >.
    </p>
    <BaseLinkButton :href="path()">{{ t('landing.thanks.backHome') }}</BaseLinkButton>
  </section>
</template>
