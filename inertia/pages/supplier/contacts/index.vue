<script setup lang="ts">
import { ref, watch } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Plus, Sparkles, UsersRound } from 'lucide-vue-next'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseSection from '~/components/base/base_section.vue'
import SupplierContactForm from '~/components/supplier/contacts/supplier_contact_form.vue'
import SupplierContactList from '~/components/supplier/contacts/supplier_contact_list.vue'
import type { SupplierContactsPageProps } from '#shared/types/supplier'

const props = defineProps<SupplierContactsPageProps>()

const { t, locale } = useI18n()

const adding = ref(false)
const showAllContacts = ref(props.showAllContacts)

watch(
  () => props.showAllContacts,
  (value) => (showAllContacts.value = value)
)

function saveSettings(value: boolean) {
  showAllContacts.value = value
  router.patch(
    urlFor('supplier.contacts.settings', { locale: locale.value }),
    { showAllContacts: value },
    { preserveScroll: true }
  )
}
</script>

<template>
  <Head :title="t('supplier.contacts.title')" />

  <div class="flex w-full flex-col gap-8">
    <BasePageHeader
      :title="t('supplier.contacts.title')"
      :description="t('supplier.contacts.subtitle')"
    >
      <template v-if="!adding" #actions>
        <BaseButton @click="adding = true">
          <Plus :size="18" aria-hidden="true" />
          {{ t('supplier.contacts.add') }}
        </BaseButton>
      </template>
    </BasePageHeader>

    <BaseAlert v-if="!isSubscribed" tone="info" :title="t('supplier.contacts.upsell.title')">
      <div class="flex flex-col items-start gap-3">
        <p>{{ t('supplier.contacts.upsell.body') }}</p>
        <BaseLinkButton
          :href="urlFor('supplier.subscription.show', { locale })"
          variant="secondary"
          size="sm"
        >
          <Sparkles :size="16" aria-hidden="true" />
          {{ t('supplier.contacts.upsell.cta') }}
        </BaseLinkButton>
      </div>
    </BaseAlert>

    <BaseSection v-if="adding" :title="t('supplier.contacts.newTitle')">
      <SupplierContactForm :members="members" @done="adding = false" @cancel="adding = false" />
    </BaseSection>

    <BaseSection
      :title="t('supplier.contacts.teamTitle')"
      :description="t('supplier.contacts.teamHint')"
    >
      <BaseEmptyState
        v-if="contacts.length === 0"
        compact
        :icon="UsersRound"
        :title="t('supplier.contacts.empty')"
        :description="t('supplier.contacts.emptyHint')"
      />
      <SupplierContactList v-else :contacts="contacts" :members="members" />
    </BaseSection>

    <BaseSection :title="t('supplier.contacts.settingsTitle')">
      <BaseCheckbox
        id="showAllContacts"
        :model-value="showAllContacts"
        :label="t('supplier.contacts.showAll')"
        :description="t('supplier.contacts.showAllHint')"
        @update:model-value="saveSettings"
      />
    </BaseSection>
  </div>
</template>
