<script setup lang="ts">
import { Link } from '@adonisjs/inertia/vue'
import { Building2 } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import BaseCard from '~/components/base/base_card.vue'
import type { SupplierType } from '#shared/types/supplier'

/** Carte fournisseur de l'annuaire : logo (ou pictogramme), nom, pays, description. */
defineProps<{ supplier: SupplierType }>()

const { locale } = useI18n()
</script>

<template>
  <Link route="suppliers.show" :params="{ locale, slug: supplier.slug }" class="block rounded-xl">
    <BaseCard as="article" hover padding="md" class="flex h-full flex-col gap-3">
      <div class="flex items-center gap-3">
        <img
          v-if="supplier.logoUrl"
          :src="supplier.logoUrl"
          :alt="supplier.name ?? supplier.slug"
          class="size-12 shrink-0 rounded-md border border-hairline bg-card object-contain"
        />
        <div
          v-else
          class="flex size-12 shrink-0 items-center justify-center rounded-md border border-hairline bg-sunken text-text-muted"
          aria-hidden="true"
        >
          <Building2 :size="20" />
        </div>
        <div class="flex min-w-0 flex-col gap-0.5">
          <h3 class="truncate text-heading-sm text-text-primary">
            {{ supplier.name ?? supplier.slug }}
          </h3>
          <p class="text-caption text-text-muted">{{ supplier.country }}</p>
        </div>
      </div>
      <p v-if="supplier.description" class="line-clamp-2 text-body-sm text-text-secondary">
        {{ supplier.description }}
      </p>
    </BaseCard>
  </Link>
</template>
