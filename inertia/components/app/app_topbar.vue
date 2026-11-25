<script setup lang="ts">
import { usePage } from '@inertiajs/vue3'
import { Menu, X } from 'lucide-vue-next'
import type { Data } from '@generated/data'
import { useI18n } from '~/i18n'
import BaseIconButton from '~/components/base/base_icon_button.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import LanguageSwitcher from '~/components/language_switcher.vue'
import NotificationBell from '~/components/notifications/notification_bell.vue'
import QuoteCartNavButton from '~/components/quote_cart/quote_cart_nav_button.vue'
import UserMenu from '~/components/user_menu.vue'
import { urlFor } from '~/client'

/**
 * Barre supérieure : burger (mobile), zone libre à gauche, puis langue,
 * panier de devis, notifications et menu utilisateur (ou connexion / inscription pour un visiteur).
 */
defineProps<{ menuOpen: boolean }>()
defineEmits<{ toggleMenu: [] }>()

const page = usePage<Data.SharedProps>()
const { t, locale } = useI18n()
</script>

<template>
  <header
    class="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-hairline bg-white/90 px-4 backdrop-blur-md md:px-8"
  >
    <BaseIconButton
      :label="menuOpen ? t('common.nav.closeMenu') : t('common.nav.openMenu')"
      class="md:hidden"
      :aria-expanded="menuOpen"
      aria-controls="app-sidebar"
      @click="$emit('toggleMenu')"
    >
      <X v-if="menuOpen" :size="20" aria-hidden="true" />
      <Menu v-else :size="20" aria-hidden="true" />
    </BaseIconButton>

    <div class="min-w-0 flex-1">
      <slot />
    </div>

    <div class="flex items-center gap-2 md:gap-3">
      <LanguageSwitcher />
      <template v-if="page.props.user">
        <QuoteCartNavButton />
        <NotificationBell />
        <UserMenu :initials="page.props.user.initials" />
      </template>
      <template v-else>
        <BaseLinkButton
          :href="urlFor('new_account.create', { locale })"
          variant="ghost"
          size="sm"
          class="hidden sm:inline-flex"
        >
          {{ t('common.nav.signup') }}
        </BaseLinkButton>
        <BaseLinkButton :href="urlFor('session.create', { locale })" size="sm">
          {{ t('common.nav.login') }}
        </BaseLinkButton>
      </template>
    </div>
  </header>
</template>
