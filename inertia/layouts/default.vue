<script setup lang="ts">
import { watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { toast, Toaster } from 'vue-sonner'
import type { Data } from '@generated/data'
import { Link, Form } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import LanguageSwitcher from '~/components/language_switcher.vue'
import OrganizationSwitcher from '~/components/organization/organization_switcher.vue'

const page = usePage<Data.SharedProps>()
const { locale } = useI18n()

watch(
  () => page.url,
  () => toast.dismiss()
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
      <div>
        <nav class="flex items-center gap-6.5">
          <LanguageSwitcher />
          <template v-if="page.props.user">
            <Link
              v-if="page.props.user.isPlatformAdmin"
              route="admin.dashboard"
              :params="{ locale }"
              class="font-medium text-[var(--gray-8)] hover:text-[var(--gray-12)]"
              >{{ t('common.nav.admin') }}</Link
            >
            <OrganizationSwitcher />
            <Link route="account.show" :params="{ locale }" :title="t('account.title')">{{
              page.props.user.initials
            }}</Link>
            <Form route="session.destroy" :params="{ locale }">
              <button
                type="submit"
                class="w-full cursor-pointer rounded bg-[var(--color-primary)] p-2.5 font-medium text-[var(--color-primary-contrast)] hover:bg-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-6)]"
              >
                {{ t('common.nav.logout') }}
              </button>
            </Form>
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
        </nav>
      </div>
    </div>
  </header>

  <main
    class="mx-7.5 flex min-h-[calc(100vh-65px)] max-w-[1440px] flex-col justify-between border border-[var(--gray-3)] bg-white"
  >
    <slot />
  </main>

  <Toaster position="top-center" rich-colors />
</template>
