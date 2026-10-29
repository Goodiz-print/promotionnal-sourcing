<script setup lang="ts">
import { Link } from '@adonisjs/inertia/vue'
import { ArrowUpRight, PanelLeftClose, PanelLeftOpen } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import BaseIconButton from '~/components/base/base_icon_button.vue'
import AppNav from '~/components/app_nav.vue'

/**
 * Colonne de navigation de l'application : logo, menu groupé, puis le lien de retour
 * au site. Sur mobile, le layout l'affiche en panneau coulissant (toujours
 * déplié). Dès md, un bouton réduit la colonne à un rail d'icônes.
 */
defineProps<{ collapsed: boolean }>()
defineEmits<{ toggleCollapse: [] }>()

const { t, locale } = useI18n()

/* Fichier de `public/` : lié par une chaîne dynamique pour que Vite ne tente pas de le résoudre comme import. */
const LOGO_SRC = '/logo.png'
</script>

<template>
  <div
    class="flex h-full flex-col gap-6 overflow-y-auto px-4 py-5"
    :class="collapsed ? 'md:px-3' : ''"
  >
    <div class="flex shrink-0 items-center justify-between gap-2">
      <Link
        route="home"
        :params="{ locale }"
        class="flex items-center px-2"
        :class="collapsed ? 'md:hidden' : ''"
      >
        <img
          :src="LOGO_SRC"
          :alt="t('common.nav.logoAlt')"
          width="776"
          height="310"
          class="h-9 w-auto"
        />
      </Link>
      <BaseIconButton
        :label="collapsed ? t('common.nav.expandSidebar') : t('common.nav.collapseSidebar')"
        class="hidden md:inline-flex"
        :class="collapsed ? 'md:mx-auto' : ''"
        :aria-expanded="!collapsed"
        aria-controls="app-sidebar"
        @click="$emit('toggleCollapse')"
      >
        <PanelLeftOpen v-if="collapsed" :size="20" aria-hidden="true" />
        <PanelLeftClose v-else :size="20" aria-hidden="true" />
      </BaseIconButton>
    </div>

    <AppNav class="flex-1" :collapsed="collapsed" />

    <div class="flex flex-col gap-3 border-t border-hairline pt-4">
      <Link
        route="home"
        :params="{ locale }"
        :title="collapsed ? t('common.nav.backToSite') : undefined"
        class="flex items-center gap-2 px-3 text-caption font-semibold text-text-muted transition-colors hover:text-text-primary"
        :class="collapsed ? 'md:justify-center md:px-0' : ''"
      >
        <ArrowUpRight :size="14" aria-hidden="true" />
        <span :class="collapsed ? 'md:sr-only' : ''">{{ t('common.nav.backToSite') }}</span>
      </Link>
    </div>
  </div>
</template>
