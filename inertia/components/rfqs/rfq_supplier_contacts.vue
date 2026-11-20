<script setup lang="ts">
import { computed } from 'vue'
import SupplierContactCards from '~/components/supplier/contacts/supplier_contact_cards.vue'
import type { RfqSupplierType } from '#shared/types/rfq'
import type { SupplierContactsByOrganization } from '#shared/types/supplier'

/**
 * Équipe commerciale des destinataires d'une demande, fournisseur par
 * fournisseur. Ne liste que les fournisseurs dont le serveur a envoyé des
 * contacts (abonnés, filtrés selon le pays de l'agence).
 */
const props = defineProps<{
  suppliers: RfqSupplierType[]
  contacts: SupplierContactsByOrganization
}>()

const groups = computed(() =>
  props.suppliers
    .map((supplier) => ({
      supplier,
      contacts: props.contacts[supplier.supplierOrganizationId] ?? [],
    }))
    .filter((group) => group.contacts.length > 0)
)
</script>

<template>
  <div class="flex flex-col gap-6">
    <div v-for="group in groups" :key="group.supplier.id" class="flex flex-col gap-3">
      <h3 class="text-body-sm font-semibold text-text-primary">{{ group.supplier.name }}</h3>
      <SupplierContactCards :contacts="group.contacts" />
    </div>
  </div>
</template>
