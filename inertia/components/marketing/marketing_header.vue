<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import type { Data } from '@generated/data'
import { urlFor } from '~/client'
import BaseLinkButton from '~/components/base_link_button.vue'
import { useMarketing } from '~/composables/use_marketing'
import type { Locale } from '#shared/types/i18n'

const page = usePage<Data.SharedProps>()
/* Fichiers de `public/` : liés par une chaîne dynamique pour que Vite ne tente pas de les résoudre comme import. */
const LOGO_SRC = '/logo.png'

const { t, locale, path, homeAnchor } = useMarketing()

const menuOpen = ref(false)

const navItems = computed(() => [
  { label: t('landing.nav.agences'), href: homeAnchor('agences') },
  { label: t('landing.nav.fournisseurs'), href: homeAnchor('fournisseurs') },
  { label: t('landing.nav.contact'), href: path('contact') },
])

/** Même page dans l'autre langue : la locale est un préfixe d'URL, donc un simple lien. */
const otherLocale = computed<Locale>(() => (locale.value === 'fr' ? 'en' : 'fr'))
const otherLocaleHref = computed(() =>
  page.url.replace(/^\/(fr|en)(?=\/|$|\?|#)/, `/${otherLocale.value}`)
)

const isLoggedIn = computed(() => Boolean(page.props.user))
const loginHref = computed(() => urlFor('session.create', { locale: locale.value }))
const appHref = computed(() => urlFor('products.index', { locale: locale.value }))
</script>

<template>
  <header data-nav class="sticky top-0 z-50 border-b border-hairline backdrop-blur-md">
    <div class="flex h-[76px] items-center justify-between px-6 md:px-10">
      <div class="flex items-center gap-11">
        <Link :href="path()" class="shrink-0">
          <img
            :src="LOGO_SRC"
            :alt="t('landing.nav.logoAlt')"
            width="776"
            height="310"
            class="h-12 w-auto"
          />
        </Link>
        <nav class="hidden items-center gap-7 text-body-sm font-bold text-text-secondary md:flex">
          <a v-for="item in navItems" :key="item.href" :href="item.href" class="nav-link">
            {{ item.label }}
          </a>
        </nav>
      </div>
      <div class="flex items-center gap-3">
        <Link
          :href="otherLocaleHref"
          :hreflang="otherLocale"
          class="hidden items-center gap-1.5 rounded-pill border border-hairline px-3 py-1.5 text-caption font-semibold text-text-secondary transition-colors duration-150 hover:border-indigo-300 hover:text-indigo-600 md:inline-flex"
        >
          {{ t('landing.nav.switchTo') }}
        </Link>
        <Link
          :href="isLoggedIn ? appHref : loginHref"
          class="hidden items-center rounded-pill border border-indigo-200 px-4 py-1.5 text-caption font-semibold text-indigo-600 transition-colors duration-150 hover:bg-indigo-50 md:inline-flex"
        >
          {{ isLoggedIn ? t('landing.nav.openApp') : t('landing.nav.login') }}
        </Link>
        <div class="hidden md:block">
          <BaseLinkButton :href="path('contact')" class="!px-5 !py-2.5 text-body-sm">
            {{ t('landing.nav.cta') }}
          </BaseLinkButton>
        </div>
        <button
          type="button"
          :aria-expanded="menuOpen"
          aria-controls="mobile-nav"
          :aria-label="t('landing.nav.menuAria')"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-text-primary md:hidden"
          @click="menuOpen = !menuOpen"
        >
          <svg v-if="!menuOpen" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M2.5 5.5h15M2.5 10h15M2.5 14.5h15"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </svg>
          <svg v-else width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M4.5 4.5l11 11M15.5 4.5l-11 11"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
    <nav
      v-show="menuOpen"
      id="mobile-nav"
      class="flex flex-col gap-1 border-t border-hairline bg-canvas px-6 pb-6 pt-3 md:hidden"
      @keydown.esc="menuOpen = false"
    >
      <a
        v-for="item in navItems"
        :key="item.href"
        :href="item.href"
        class="rounded-md px-2 py-3 text-body-md font-bold text-text-primary"
        @click="menuOpen = false"
      >
        {{ item.label }}
      </a>
      <BaseLinkButton :href="path('contact')" class="mt-3 w-full text-center">
        {{ t('landing.nav.cta') }}
      </BaseLinkButton>
      <Link
        :href="isLoggedIn ? appHref : loginHref"
        class="mt-3 inline-flex items-center justify-center rounded-pill border border-indigo-200 px-4 py-2 text-body-sm font-semibold text-indigo-600"
      >
        {{ isLoggedIn ? t('landing.nav.openApp') : t('landing.nav.login') }}
      </Link>
      <Link
        :href="otherLocaleHref"
        :hreflang="otherLocale"
        class="mt-1 inline-flex items-center gap-1.5 self-center rounded-pill border border-hairline px-3.5 py-2 text-body-sm font-semibold text-text-secondary"
      >
        {{ t('landing.nav.switchTo') }}
      </Link>
    </nav>
  </header>
</template>
