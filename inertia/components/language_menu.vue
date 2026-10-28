<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Link } from '@adonisjs/inertia/vue'
import FlagIcon from '~/components/flag_icon.vue'
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
  'flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2 text-left text-sm text-[var(--gray-10)] hover:bg-[var(--gray-2)]'

const open = ref(false)
const root = ref<HTMLElement | null>(null)

function pick(locale: Locale) {
  open.value = false
  if (locale !== props.current) emit('select', locale)
}

function closeOnOutsideClick(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false
}

function closeOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', closeOnOutsideClick)
  document.addEventListener('keydown', closeOnEscape)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', closeOnOutsideClick)
  document.removeEventListener('keydown', closeOnEscape)
})
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      :aria-label="label"
      aria-haspopup="listbox"
      :aria-expanded="open"
      class="inline-flex cursor-pointer items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
      :class="buttonClass"
      @click="open = !open"
    >
      <FlagIcon :code="current" />
      {{ LOCALE_LABELS[current] }}
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="m4 6 4 4 4-4"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <ul
      v-show="open"
      role="listbox"
      :aria-label="label"
      class="absolute right-0 z-50 mt-2 min-w-44 overflow-hidden rounded-lg border border-[var(--gray-3)] bg-white py-1 shadow-lg"
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
