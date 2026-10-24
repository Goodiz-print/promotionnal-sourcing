<script setup lang="ts">
import { ref, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { toast, Toaster } from 'vue-sonner'
import type { Data } from '@generated/data'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import AppNav from '~/components/app_nav.vue'
import UserMenu from '~/components/user_menu.vue'
import LanguageSwitcher from '~/components/language_switcher.vue'
import OrganizationSwitcher from '~/components/organization/organization_switcher.vue'

const page = usePage<Data.SharedProps>()
const { t, locale } = useI18n()

const mobileMenuOpen = ref(false)

watch(
  () => page.url,
  () => {
    toast.dismiss()
    mobileMenuOpen.value = false
  }
)

watch(
  () => page.props.flash,
  (flashMessages) => {
    if (flashMessages.error) {
      toast.error(flashMessages.error)
    }
    if (flashMessages.success) {
      toast.success(flashMessages.success)
    }
  },
  { immediate: true }
)
</script>

<template>
  <header class="mx-auto max-w-[1440px] px-7.5">
    <div class="flex h-16 items-center justify-between">
      <div>
        <Link route="home" :params="{ locale }">
          <svg
            width="66"
            height="24"
            viewBox="0 0 105 38"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0 0h7.5v15H0ZM7.5 15h7.5v15H7.5ZM15 30h7.5v7.5H15ZM22.5 15h7.5v15H22.5ZM30 0h7.5v15H30ZM45 0h7.5v30h15v-30h7.5v37.5h-30v-37.5ZM82.5 37.5V0H105v7.5H90V15h15v7.5H90V30h15v7.5H82.5Z"
              fill="currentColor"
            />
          </svg>
        </Link>
      </div>
      <AppNav class="ml-6 hidden flex-1 md:flex" />
      <div class="flex items-center gap-4 md:gap-6.5">
        <LanguageSwitcher />
        <template v-if="page.props.user">
          <OrganizationSwitcher />
          <UserMenu :initials="page.props.user.initials" />
        </template>
        <template v-else>
          <Link
            route="new_account.create"
            :params="{ locale }"
            class="font-medium text-[var(--gray-8)] hover:text-[var(--gray-12)]"
            >{{ t('common.nav.signup') }}</Link
          >
          <Link
            route="session.create"
            :params="{ locale }"
            class="font-medium text-[var(--gray-8)] hover:text-[var(--gray-12)]"
            >{{ t('common.nav.login') }}</Link
          >
        </template>
        <button
          type="button"
          class="cursor-pointer rounded p-2 hover:bg-[var(--gray-2)] md:hidden"
          :aria-expanded="mobileMenuOpen"
          aria-controls="mobile-menu"
          :aria-label="t('common.nav.menu')"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <span aria-hidden="true">☰</span>
        </button>
      </div>
    </div>
    <div v-if="mobileMenuOpen" id="mobile-menu" class="pb-3 md:hidden">
      <AppNav orientation="vertical" />
    </div>
  </header>

  <main
    class="mx-7.5 flex min-h-[calc(100vh-65px)] max-w-[1440px] flex-col justify-between border border-[var(--gray-3)] bg-white"
  >
    <slot />
  </main>

  <Toaster position="top-center" rich-colors />
</template>
