<script setup lang="ts">
import { computed } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { Building2, ChevronsUpDown } from 'lucide-vue-next'
import type { Data } from '@generated/data'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'

const page = usePage<Data.SharedProps>()
const { t, locale } = useI18n()

const organizations = computed(() => page.props.organizations ?? [])
const currentId = computed(() => page.props.currentOrganizationId)
const current = computed(() =>
  organizations.value.find((organization) => organization.id === currentId.value)
)

/**
 * Le sélecteur n'a de sens qu'au-delà d'une organisation : avec une seule, elle
 * est imposée par le contexte (onboarding ou acceptation d'invitation) et il n'y
 * a rien à choisir — on affiche alors simplement son nom.
 */
const isSelectable = computed(() => organizations.value.length > 1)

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
  <div
    v-if="current"
    class="relative flex items-center gap-2.5 rounded-lg border border-hairline bg-sunken px-3 py-2"
  >
    <span
      class="flex size-8 shrink-0 items-center justify-center rounded-md bg-card text-indigo-600 shadow-elevation-1"
      aria-hidden="true"
    >
      <Building2 :size="16" />
    </span>
    <template v-if="isSelectable">
      <label class="sr-only" for="organization-switcher">{{
        t('organization.switch.label')
      }}</label>
      <select
        id="organization-switcher"
        :value="currentId"
        class="min-w-0 flex-1 cursor-pointer appearance-none truncate bg-transparent pr-6 text-body-sm font-semibold text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        @change="switchOrganization"
      >
        <option
          v-for="organization in organizations"
          :key="organization.id"
          :value="organization.id"
        >
          {{ organization.name }}
        </option>
      </select>
      <ChevronsUpDown
        :size="14"
        class="pointer-events-none absolute right-3 text-text-muted"
        aria-hidden="true"
      />
    </template>
    <span v-else class="min-w-0 flex-1 truncate text-body-sm font-semibold text-text-primary">
      {{ current.name }}
    </span>
  </div>
</template>
