<script setup lang="ts">
import { Link } from '@adonisjs/inertia/vue'
import { ArrowUpRight } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import AppNav from '~/components/app_nav.vue'
import OrganizationSwitcher from '~/components/organization/organization_switcher.vue'

/**
 * Colonne de navigation de l'application : logo, menu groupé, puis le sélecteur
 * d'organisation. Sur mobile, le layout l'affiche en panneau coulissant.
 */
const { t, locale } = useI18n()

/* Fichier de `public/` : lié par une chaîne dynamique pour que Vite ne tente pas de le résoudre comme import. */
const LOGO_SRC = '/logo.png'
</script>

<template>
  <div class="flex h-full flex-col gap-6 overflow-y-auto px-4 py-5">
    <Link route="home" :params="{ locale }" class="flex shrink-0 items-center px-2">
      <img
        :src="LOGO_SRC"
        :alt="t('common.nav.logoAlt')"
        width="776"
        height="310"
        class="h-9 w-auto"
      />
    </Link>

    <AppNav class="flex-1" />

    <div class="flex flex-col gap-3 border-t border-hairline pt-4">
      <OrganizationSwitcher />
      <Link
        route="home"
        :params="{ locale }"
        class="flex items-center gap-2 px-3 text-caption font-semibold text-text-muted transition-colors hover:text-text-primary"
      >
        <ArrowUpRight :size="14" aria-hidden="true" />
        {{ t('common.nav.backToSite') }}
      </Link>
    </div>
  </div>
</template>
