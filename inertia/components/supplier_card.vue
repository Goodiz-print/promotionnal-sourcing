<script setup lang="ts">
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import type { SupplierType } from '#shared/types/supplier'

defineProps<{ supplier: SupplierType }>()

const { locale } = useI18n()
</script>

<template>
  <Link
    route="suppliers.show"
    :params="{ locale, slug: supplier.slug }"
    class="flex flex-col gap-2 rounded border border-[var(--gray-3)] p-5 hover:bg-[var(--gray-1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
  >
    <div class="flex items-center gap-3">
      <img
        v-if="supplier.logoUrl"
        :src="supplier.logoUrl"
        :alt="supplier.name ?? supplier.slug"
        class="h-10 w-10 rounded object-contain"
      />
      <div>
        <h3 class="font-semibold tracking-[-0.3px]">{{ supplier.name ?? supplier.slug }}</h3>
        <span class="text-sm text-[var(--gray-6)]">{{ supplier.country }}</span>
      </div>
    </div>
    <p v-if="supplier.description" class="line-clamp-2 text-sm text-[var(--gray-6)]">
      {{ supplier.description }}
    </p>
  </Link>
</template>
