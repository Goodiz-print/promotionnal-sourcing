<script setup lang="ts">
import { computed } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import type { Data } from '@generated/data'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'

const page = usePage<Data.SharedProps>()
const { t, locale } = useI18n()

const organizations = computed(() => page.props.organizations ?? [])
const currentId = computed(() => page.props.currentOrganizationId)

/**
 * Le sélecteur n'a de sens qu'au-delà d'une organisation : avec une seule, elle
 * est imposée par le contexte (onboarding ou acceptation d'invitation) et il n'y
 * a rien à choisir.
 */
const isVisible = computed(() => organizations.value.length > 1)

function switchOrganization(event: Event) {
  const next = Number((event.target as HTMLSelectElement).value)
  if (next === currentId.value) return

  router.post(
    urlFor('organization.switch', { locale: locale.value, id: next }),
    {},
    { preserveScroll: true }
  )
}
</script>

<template>
  <div v-if="isVisible">
    <label class="sr-only" for="organization-switcher">{{ t('organization.switch.label') }}</label>
    <select
      id="organization-switcher"
      :value="currentId"
      class="cursor-pointer rounded border border-[var(--gray-4)] bg-white px-2 py-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
      @change="switchOrganization"
    >
      <option v-for="organization in organizations" :key="organization.id" :value="organization.id">
        {{ organization.name }}
      </option>
    </select>
  </div>
</template>
