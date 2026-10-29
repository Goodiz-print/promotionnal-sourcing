<script setup lang="ts">
import { ref } from 'vue'
import { Link } from '@adonisjs/inertia/vue'
import { ChevronDown } from 'lucide-vue-next'
import FlagIcon from '~/components/flag_icon.vue'
import { useDismissable } from '~/composables/use_dismissable'
import { LOCALE_LABELS, type Locale } from '#shared/types/i18n'

const props = defineProps<{
  current: Locale
  locales: readonly Locale[]
  /** Libellé accessible du sélecteur (lu par les lecteurs d'écran). */
  label: string
  /** Si fourni, chaque langue est un lien (SEO, navigation Inertia) ; sinon un bouton qui émet `select`. */
  hrefFor?: (locale: Locale) => string
  /** Classes du bouton déclencheur (le style diffère entre l'app et la landing). */
  buttonClass?: string
}>()

const emit = defineEmits<{ select: [locale: Locale] }>()

const itemClass =
  'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-left text-body-sm text-text-primary transition-colors hover:bg-sunken'

const root = ref<HTMLElement | null>(null)
const { open, toggle, close } = useDismissable(root)

function pick(locale: Locale) {
  close()
  if (locale !== props.current) emit('select', locale)
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      :aria-label="label"
      aria-haspopup="listbox"
      :aria-expanded="open"
      class="inline-flex cursor-pointer items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      :class="buttonClass"
      @click="toggle"
    >
      <FlagIcon :code="current" />
      {{ LOCALE_LABELS[current] }}
      <ChevronDown :size="12" aria-hidden="true" />
    </button>
    <ul
      v-show="open"
      role="listbox"
      :aria-label="label"
      class="absolute right-0 z-50 mt-2 min-w-44 overflow-hidden rounded-lg border border-hairline bg-card p-1 shadow-elevation-2"
    >
      <li v-for="code in locales" :key="code" role="option" :aria-selected="code === current">
        <Link
          v-if="hrefFor"
          :href="hrefFor(code)"
          :hreflang="code"
          :class="[itemClass, { 'font-semibold': code === current }]"
          @click="pick(code)"
        >
          <FlagIcon :code="code" />
          {{ LOCALE_LABELS[code] }}
        </Link>
        <button
          v-else
          type="button"
          :class="[itemClass, { 'font-semibold': code === current }]"
          @click="pick(code)"
        >
          <FlagIcon :code="code" />
          {{ LOCALE_LABELS[code] }}
        </button>
      </li>
    </ul>
  </div>
</template>
