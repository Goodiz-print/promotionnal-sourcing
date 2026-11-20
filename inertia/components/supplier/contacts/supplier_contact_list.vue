<script setup lang="ts">
import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { ArrowDown, ArrowUp, Pencil, Trash2, UserRound } from 'lucide-vue-next'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import BaseIconButton from '~/components/base/base_icon_button.vue'
import SupplierContactForm from '~/components/supplier/contacts/supplier_contact_form.vue'
import SupplierContactSummary from '~/components/supplier/contacts/supplier_contact_summary.vue'
import type {
  SupplierContactMove,
  SupplierContactType,
  SupplierTeamMemberOptionType,
} from '#shared/types/supplier'

/**
 * Équipe commerciale dans l'espace fournisseur : une ligne par contact, dans
 * l'ordre d'affichage, avec déplacement, modification en place et retrait.
 */
const props = defineProps<{
  contacts: SupplierContactType[]
  members: SupplierTeamMemberOptionType[]
}>()

const { t, locale } = useI18n()

const editingId = ref<number | null>(null)

/** Nom du membre relié, vide pour une simple fiche de contact. */
function memberName(contact: SupplierContactType): string {
  if (contact.userId === null) return ''
  return props.members.find((member) => member.id === contact.userId)?.name ?? ''
}

function move(contact: SupplierContactType, direction: SupplierContactMove) {
  router.post(
    urlFor('supplier.contacts.move', { locale: locale.value, id: contact.id }),
    { direction },
    { preserveScroll: true, only: ['contacts'] }
  )
}

function remove(contact: SupplierContactType) {
  if (!window.confirm(t('supplier.contacts.confirmDelete', { name: contact.name }))) return
  router.delete(urlFor('supplier.contacts.destroy', { locale: locale.value, id: contact.id }), {
    preserveScroll: true,
  })
}
</script>

<template>
  <ul class="flex flex-col">
    <li
      v-for="(contact, index) in contacts"
      :key="contact.id"
      class="border-b border-hairline py-4 first:pt-0 last:border-0 last:pb-0"
    >
      <SupplierContactForm
        v-if="editingId === contact.id"
        :contact="contact"
        :members="members"
        @done="editingId = null"
        @cancel="editingId = null"
      />
      <div v-else class="flex items-start gap-3">
        <SupplierContactSummary class="min-w-0 flex-1" :contact="contact">
          <template v-if="memberName(contact)" #badge>
            <span class="inline-flex items-center gap-1 text-caption text-text-muted">
              <UserRound :size="14" aria-hidden="true" />
              {{ t('supplier.contacts.linkedMember', { name: memberName(contact) }) }}
            </span>
          </template>
        </SupplierContactSummary>
        <div class="flex shrink-0 items-center">
          <BaseIconButton
            :label="t('supplier.contacts.moveUp')"
            :disabled="index === 0"
            @click="move(contact, 'up')"
          >
            <ArrowUp :size="16" aria-hidden="true" />
          </BaseIconButton>
          <BaseIconButton
            :label="t('supplier.contacts.moveDown')"
            :disabled="index === contacts.length - 1"
            @click="move(contact, 'down')"
          >
            <ArrowDown :size="16" aria-hidden="true" />
          </BaseIconButton>
          <BaseIconButton :label="t('supplier.contacts.edit')" @click="editingId = contact.id">
            <Pencil :size="16" aria-hidden="true" />
          </BaseIconButton>
          <BaseIconButton :label="t('supplier.contacts.delete')" @click="remove(contact)">
            <Trash2 :size="16" aria-hidden="true" />
          </BaseIconButton>
        </div>
      </div>
    </li>
  </ul>
</template>
