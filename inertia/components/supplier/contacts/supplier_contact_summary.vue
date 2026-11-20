<script setup lang="ts">
import { computed } from 'vue'
import { Globe, Languages, Mail, Phone } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { useRegionOptions } from '~/composables/use_region_options'
import type { SupplierContactType } from '#shared/types/supplier'

/**
 * Fiche d'un contact commercial : nom, fonction, coordonnées cliquables, pays
 * couverts et langues. Slot `badge` : mention affichée sous le nom.
 */
const props = defineProps<{ contact: SupplierContactType }>()

const { t } = useI18n()
const { countryName, languageName } = useRegionOptions()

const countries = computed(() =>
  props.contact.countries.length === 0
    ? t('supplier.contacts.allCountries')
    : props.contact.countries.map(countryName).join(', ')
)

const languages = computed(() => props.contact.languages.map(languageName).join(', '))
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div>
      <p class="text-body-sm font-semibold text-text-primary">{{ contact.name }}</p>
      <p v-if="contact.jobTitle" class="text-caption text-text-secondary">
        {{ contact.jobTitle }}
      </p>
      <slot name="badge" />
    </div>
    <ul class="flex flex-col gap-1 text-caption text-text-secondary">
      <li class="flex items-center gap-1.5">
        <Mail :size="14" class="shrink-0 text-text-muted" aria-hidden="true" />
        <a :href="`mailto:${contact.email}`" class="truncate text-indigo-600 hover:underline">
          {{ contact.email }}
        </a>
      </li>
      <li v-if="contact.phone" class="flex items-center gap-1.5">
        <Phone :size="14" class="shrink-0 text-text-muted" aria-hidden="true" />
        <a :href="`tel:${contact.phone}`" class="hover:underline">{{ contact.phone }}</a>
      </li>
      <li class="flex items-center gap-1.5">
        <Globe :size="14" class="shrink-0 text-text-muted" aria-hidden="true" />
        <span>
          <span class="sr-only">{{ t('supplier.contacts.fields.countries') }} :</span>
          {{ countries }}
        </span>
      </li>
      <li v-if="languages" class="flex items-center gap-1.5">
        <Languages :size="14" class="shrink-0 text-text-muted" aria-hidden="true" />
        <span>
          <span class="sr-only">{{ t('supplier.contacts.fields.languages') }} :</span>
          {{ languages }}
        </span>
      </li>
    </ul>
  </div>
</template>
