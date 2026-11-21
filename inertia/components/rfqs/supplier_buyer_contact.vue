<script setup lang="ts">
import { computed, type Component } from 'vue'
import { Building2, Mail, MapPin, Phone, UserRound } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import BaseSection from '~/components/base/base_section.vue'
import type { BuyerContactType } from '#shared/types/rfq'

/**
 * Coordonnées de l'agence sur une demande reçue (#221). Le serveur ne les
 * envoie qu'à un fournisseur abonné : pour un non abonné, la page ne monte pas
 * ce bloc. Les lignes sans valeur sont omises.
 */
const props = defineProps<{ contact: BuyerContactType }>()

const { t } = useI18n()

interface ContactRow {
  key: keyof BuyerContactType
  icon: Component
  value: string | null
  /** Lien `mailto:` / `tel:` quand la valeur s'y prête. */
  href: string | null
}

const rows = computed<ContactRow[]>(() => {
  const { agencyName, requesterName, email, phone, addressLines } = props.contact
  const all: ContactRow[] = [
    { key: 'agencyName', icon: Building2, value: agencyName, href: null },
    { key: 'requesterName', icon: UserRound, value: requesterName, href: null },
    { key: 'email', icon: Mail, value: email, href: email && `mailto:${email}` },
    { key: 'phone', icon: Phone, value: phone, href: phone && `tel:${phone}` },
    { key: 'addressLines', icon: MapPin, value: addressLines.join(', ') || null, href: null },
  ]
  return all.filter((row) => row.value)
})

const LABEL_KEYS: Record<keyof BuyerContactType, string> = {
  agencyName: 'agency',
  requesterName: 'requester',
  email: 'email',
  phone: 'phone',
  addressLines: 'address',
}
</script>

<template>
  <BaseSection :title="t('rfq.supplier.show.contact.title')">
    <dl class="grid gap-4 sm:grid-cols-2">
      <div v-for="row in rows" :key="row.key" class="flex items-start gap-2" :data-row="row.key">
        <component
          :is="row.icon"
          :size="16"
          class="mt-0.5 shrink-0 text-text-muted"
          aria-hidden="true"
        />
        <div class="flex min-w-0 flex-col">
          <dt class="text-caption text-text-secondary">
            {{ t(`rfq.supplier.show.contact.${LABEL_KEYS[row.key]}`) }}
          </dt>
          <dd class="text-body-sm text-text-primary">
            <a v-if="row.href" :href="row.href" class="break-all text-indigo-600 hover:underline">
              {{ row.value }}
            </a>
            <template v-else>{{ row.value }}</template>
          </dd>
        </div>
      </div>
    </dl>
  </BaseSection>
</template>
