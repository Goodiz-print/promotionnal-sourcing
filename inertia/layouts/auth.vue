<script setup lang="ts">
import { watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { toast, Toaster } from 'vue-sonner'
import { ArrowLeft } from 'lucide-vue-next'
import type { Data } from '@generated/data'
import { useI18n } from '~/i18n'
import GradientMesh from '~/components/marketing/gradient_mesh.vue'
import LanguageSwitcher from '~/components/language_switcher.vue'

/**
 * Layout « focalisé » (connexion, inscription, onboarding, invitations) : une
 * carte centrée sur fond sunken avec le halo de la landing, sans navigation.
 */
const page = usePage<Data.SharedProps>()
const { t, locale } = useI18n()

const LOGO_SRC = '/logo.png'

watch(
  () => page.url,
  () => toast.dismiss()
)

watch(
  () => page.props.flash,
  (flashMessages) => {
    if (flashMessages.error) toast.error(flashMessages.error)
    if (flashMessages.success) toast.success(flashMessages.success)
  },
  { immediate: true }
)
</script>

<template>
  <div class="relative flex min-h-screen flex-col overflow-hidden bg-sunken">
    <GradientMesh />
    <header class="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
      <Link route="home" :params="{ locale }" class="flex items-center">
        <img
          :src="LOGO_SRC"
          :alt="t('common.nav.logoAlt')"
          width="776"
          height="310"
          class="h-9 w-auto"
        />
      </Link>
      <div class="flex items-center gap-3">
        <Link
          route="home"
          :params="{ locale }"
          class="hidden items-center gap-1.5 text-body-sm font-semibold text-text-secondary transition-colors hover:text-indigo-600 sm:inline-flex"
        >
          <ArrowLeft :size="16" aria-hidden="true" />
          {{ t('common.nav.backToSite') }}
        </Link>
        <LanguageSwitcher />
      </div>
    </header>
    <main class="relative z-10 flex flex-1 flex-col items-center px-4 pt-6 pb-16 md:pt-10">
      <div
        class="w-full max-w-[460px] rounded-xl border border-hairline bg-card p-6 shadow-elevation-2 sm:p-8"
      >
        <slot />
      </div>
    </main>
  </div>
  <Toaster position="top-center" rich-colors />
</template>
