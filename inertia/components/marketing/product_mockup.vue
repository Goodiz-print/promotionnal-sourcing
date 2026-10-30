<script setup lang="ts">
import { useMarketing } from '~/composables/use_marketing'

const { t } = useMarketing()

const TAG_INDEXES = [0, 1, 2]
const PRODUCTS = [
  { index: 0, verified: true, price: '2,10', image: '/img/mo2197-09.webp' },
  { index: 1, verified: true, price: '1,85', image: '/img/tote-bag-coton-moutarde.webp' },
  { index: 2, verified: false, price: '2,40', image: '/img/tote-bag-coton-soufflet.webp' },
]
</script>

<template>
  <div
    data-reveal
    class="anim-float relative w-full rounded-[20px] bg-card p-[26px] text-left shadow-elevation-3"
    role="img"
    :aria-label="t('landing.productMockup.ariaLabel')"
  >
    <div aria-hidden="true">
      <div class="mb-3.5 flex items-center gap-3 rounded-xl border-2 border-hairline px-4 py-3">
        <span class="flex-1 truncate text-body-sm font-medium text-text-primary">
          {{ t('landing.productMockup.products.0.name') }}
        </span>
        <span class="anim-caret h-[15px] w-0.5 shrink-0 bg-indigo-500" />
        <span
          class="shrink-0 rounded-pill px-3 py-1.5 text-[11px] font-extrabold tracking-wide text-white"
          style="background: linear-gradient(100deg, var(--indigo-500), #7a3fd4)"
        >
          ✦ {{ t('landing.productMockup.aiChip') }}
        </span>
      </div>
      <div class="mb-[18px] flex flex-wrap gap-2">
        <span
          v-for="i in TAG_INDEXES"
          :key="i"
          class="rounded-pill bg-brand-subtle px-3 py-1.5 text-caption font-semibold text-indigo-600"
        >
          {{ t(`landing.productMockup.tags.${i}`) }}
        </span>
      </div>
      <div
        v-for="(product, i) in PRODUCTS"
        :key="product.index"
        class="flex items-center gap-3.5 rounded-xl border border-hairline p-3"
        :class="{ 'mb-2.5': i < PRODUCTS.length - 1 }"
      >
        <div class="h-[50px] w-[38px] shrink-0 overflow-hidden rounded-md">
          <img
            :src="product.image"
            :alt="t(`landing.productMockup.products.${product.index}.name`)"
            width="56"
            height="70"
            class="h-full w-full object-cover"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-body-sm font-semibold text-text-primary">
            {{ t(`landing.productMockup.products.${product.index}.name`) }}
          </p>
          <p class="truncate text-caption text-text-muted">
            {{
              product.verified
                ? t('landing.productMockup.verifiedLabel')
                : t('landing.productMockup.supplierLabel')
            }}
            · {{ t(`landing.productMockup.products.${product.index}.country`) }}
          </p>
        </div>
        <p class="text-tabular shrink-0 text-body-sm font-bold text-indigo-600">
          {{ t('landing.productMockup.priceFrom') }} {{ product.price }}
          {{ t('landing.productMockup.priceSuffix') }}
        </p>
      </div>
      <div class="mt-3.5 flex items-center justify-between text-caption text-text-muted">
        <span>{{ t('landing.productMockup.footerCompare') }}</span>
        <span class="font-bold text-amber-600">{{ t('landing.productMockup.footerFlag') }}</span>
      </div>
    </div>
  </div>
</template>
