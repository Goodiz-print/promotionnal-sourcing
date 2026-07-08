<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '~/i18n'
import { router, usePage } from '@inertiajs/vue3'
import type { Data } from '@generated/data'
import { LOCALE_LABELS, type Locale } from '#shared/types/i18n'

const page = usePage<Data.SharedProps>()
const { t, locale } = useI18n()

const locales = computed(() => (page.props.supportedLocales ?? []) as Locale[])

function switchLocale(event: Event) {
  const next = (event.target as HTMLSelectElement).value as Locale
  if (next === locale.value) {
    return
  }

  router.post('/locale', { locale: next }, { preserveScroll: true, preserveState: true })
}
</script>

<template>
  <div>
    <label class="sr-only" for="locale-switcher">{{ t('common.language.label') }}</label>
    <select
      id="locale-switcher"
      :value="locale"
      class="cursor-pointer rounded border border-[var(--gray-4)] bg-white px-2 py-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
      @change="switchLocale"
    >
      <option v-for="l in locales" :key="l" :value="l">{{ LOCALE_LABELS[l] }}</option>
    </select>
  </div>
</template>
