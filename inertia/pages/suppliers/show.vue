<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import ProductCard from '~/components/product_card.vue'
import type { SupplierDetailType } from '#shared/types/supplier'

const props = defineProps<{ supplier: SupplierDetailType }>()

const { t } = useI18n()
const profile = props.supplier.supplierProfile
</script>

<template>
  <Head :title="supplier.name ?? supplier.slug" />

  <div class="mx-auto flex max-w-[960px] flex-col gap-10 px-6 py-12">
    <header class="flex items-start gap-4">
      <img
        v-if="supplier.logoUrl"
        :src="supplier.logoUrl"
        :alt="supplier.name ?? supplier.slug"
        class="h-16 w-16 rounded object-contain"
      />
      <div class="flex flex-col gap-1">
        <h1 class="text-[32px] tracking-[-0.5px]">{{ supplier.name ?? supplier.slug }}</h1>
        <span class="text-[var(--gray-6)]">{{ supplier.country }}</span>
        <a
          v-if="supplier.website"
          :href="supplier.website"
          target="_blank"
          rel="noopener"
          class="text-sm font-medium text-[var(--color-primary)] hover:underline"
        >
          {{ t('suppliers.show.website') }}
        </a>
      </div>
    </header>

    <p v-if="supplier.description" class="text-lg text-[var(--gray-7)]">
      {{ supplier.description }}
    </p>

    <section v-if="profile" class="flex flex-col gap-3 rounded border border-[var(--gray-3)] p-6">
      <h2 class="text-xl font-semibold tracking-[-0.4px]">{{ t('suppliers.show.profile') }}</h2>
      <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div v-if="profile.deliveryScope">
          <dt class="text-sm font-medium">{{ t('supplier.fields.deliveryScope') }}</dt>
          <dd class="text-[var(--gray-6)]">
            {{ t(`supplier.deliveryScope.${profile.deliveryScope}`) }}
          </dd>
        </div>
        <div v-if="profile.minOrderQuantity !== null">
          <dt class="text-sm font-medium">{{ t('supplier.fields.minOrderQuantity') }}</dt>
          <dd class="text-[var(--gray-6)]">{{ profile.minOrderQuantity }}</dd>
        </div>
        <div v-if="profile.deliveryDays !== null">
          <dt class="text-sm font-medium">{{ t('supplier.fields.deliveryDays') }}</dt>
          <dd class="text-[var(--gray-6)]">{{ profile.deliveryDays }}</dd>
        </div>
        <div v-if="profile.responseTimeDays !== null">
          <dt class="text-sm font-medium">{{ t('supplier.fields.responseTimeDays') }}</dt>
          <dd class="text-[var(--gray-6)]">{{ profile.responseTimeDays }}</dd>
        </div>
      </dl>
      <div
        v-if="profile.certifications && profile.certifications.length"
        class="flex flex-wrap gap-2"
      >
        <span
          v-for="cert in profile.certifications"
          :key="cert"
          class="rounded border border-[var(--gray-4)] px-2 py-0.5 text-sm"
        >
          {{ cert }}
        </span>
      </div>
      <p v-if="profile.bio" class="text-[var(--gray-6)]">{{ profile.bio }}</p>
    </section>

    <section class="flex flex-col gap-4">
      <h2 class="text-xl font-semibold tracking-[-0.4px]">{{ t('suppliers.show.products') }}</h2>
      <p v-if="supplier.products.length === 0" class="text-[var(--gray-6)]">
        {{ t('suppliers.show.noProducts') }}
      </p>
      <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <ProductCard v-for="product in supplier.products" :key="product.id" :product="product" />
      </div>
    </section>
  </div>
</template>
