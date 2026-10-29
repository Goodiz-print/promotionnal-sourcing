<script setup lang="ts">
import { ref, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { toast, Toaster } from 'vue-sonner'
import type { Data } from '@generated/data'
import AppSidebar from '~/components/app/app_sidebar.vue'
import AppTopbar from '~/components/app/app_topbar.vue'
import { useSidebarCollapsed } from '~/composables/use_sidebar_collapsed'

/**
 * Shell applicatif : sidebar fixe (panneau coulissant sur mobile) + topbar +
 * contenu sur fond « sunken ». Les pages posent leurs cartes blanches dessus.
 * Le contenu occupe toute la largeur disponible. Dès md, la sidebar se réduit à un rail d'icônes (choix mémorisé).
 */
const page = usePage<Data.SharedProps>()

const mobileMenuOpen = ref(false)
const { collapsed, toggle: toggleCollapsed } = useSidebarCollapsed()

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
  <div
    class="min-h-screen bg-sunken md:grid md:transition-[grid-template-columns] md:duration-200 md:ease-out"
    :class="collapsed ? 'md:grid-cols-[72px_minmax(0,1fr)]' : 'md:grid-cols-[264px_minmax(0,1fr)]'"
  >
    <div
      v-if="mobileMenuOpen"
      class="fixed inset-0 z-40 bg-ink-950/40 md:hidden"
      aria-hidden="true"
      @click="mobileMenuOpen = false"
    />
    <aside
      id="app-sidebar"
      class="fixed inset-y-0 left-0 z-50 w-[272px] border-r border-hairline bg-card shadow-elevation-3 transition-transform duration-200 ease-out md:sticky md:top-0 md:h-screen md:w-auto md:translate-x-0 md:shadow-none"
      :class="mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <AppSidebar :collapsed="collapsed" @toggle-collapse="toggleCollapsed" />
    </aside>

    <div class="flex min-h-screen min-w-0 flex-col">
      <AppTopbar :menu-open="mobileMenuOpen" @toggle-menu="mobileMenuOpen = !mobileMenuOpen" />
      <main class="flex w-full flex-1 flex-col px-4 py-6 md:px-8 md:py-8">
        <slot />
      </main>
    </div>
  </div>

  <Toaster position="top-center" rich-colors />
</template>
