<script setup lang="ts">
import BaseCard from '~/components/base/base_card.vue'
import SupplierContactSummary from '~/components/supplier/contacts/supplier_contact_summary.vue'
import type { SupplierContactType } from '#shared/types/supplier'

/**
 * Équipe commerciale d'un fournisseur vue par une agence : une carte par
 * contact. La liste est déjà filtrée par le serveur (abonnement, pays).
 */
defineProps<{ contacts: SupplierContactType[] }>()
</script>

<template>
  <ul class="grid gap-3 sm:grid-cols-2">
    <BaseCard v-for="contact in contacts" :key="contact.id" as="li" variant="sunken" padding="sm">
      <SupplierContactSummary :contact="contact" />
    </BaseCard>
  </ul>
</template>
