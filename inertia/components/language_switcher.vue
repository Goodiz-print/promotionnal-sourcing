<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '~/i18n'
import { router, usePage } from '@inertiajs/vue3'
import type { Data } from '@generated/data'
import LanguageMenu from '~/components/language_menu.vue'
import type { Locale } from '#shared/types/i18n'

const page = usePage<Data.SharedProps>()
const { t, locale } = useI18n()

const locales = computed(() => (page.props.supportedLocales ?? []) as Locale[])

function switchLocale(next: Locale) {
  router.post('/locale', { locale: next }, { preserveScroll: true, preserveState: true })
}
</script>

<template>
  <LanguageMenu
    :current="locale"
    :locales="locales"
    :label="t('common.language.label')"
    button-class="rounded border border-[var(--gray-4)] bg-white px-2 py-1 text-sm font-medium"
    @select="switchLocale"
  />
</template>
