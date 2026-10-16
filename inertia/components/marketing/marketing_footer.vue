<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@adonisjs/inertia/vue'
import { useMarketing } from '~/composables/use_marketing'

/* Fichiers de `public/` : liés par une chaîne dynamique pour que Vite ne tente pas de les résoudre comme import. */
const LOGO_SRC = '/logo.png'

const { t, path, homeAnchor } = useMarketing()

const columns = computed(() => [
  {
    title: t('landing.footer.columnPlatform'),
    links: [
      { label: t('landing.footer.linkAgencies'), href: homeAnchor('agences') },
      { label: t('landing.footer.linkSuppliers'), href: homeAnchor('fournisseurs') },
      { label: t('landing.footer.linkContact'), href: path('contact') },
    ],
  },
  {
    title: t('landing.footer.columnLegal'),
    links: [
      { label: t('landing.footer.linkLegalMentions'), href: path('legal') },
      { label: t('landing.footer.linkPrivacy'), href: path('privacy') },
    ],
  },
])
</script>

<template>
  <footer class="wrapper py-16">
    <div class="mb-12 flex flex-wrap justify-between gap-10">
      <div>
        <img
          :src="LOGO_SRC"
          :alt="t('landing.nav.logoAlt')"
          width="776"
          height="310"
          class="mb-3 h-9 w-auto"
        />
        <p class="text-caption text-text-muted">{{ t('landing.footer.location') }}</p>
      </div>
      <div class="flex flex-wrap gap-14">
        <div v-for="column in columns" :key="column.title">
          <p class="mb-3.5 text-caption font-bold text-text-primary">{{ column.title }}</p>
          <Link
            v-for="link in column.links"
            :key="link.href"
            :href="link.href"
            class="block py-1.5 text-caption text-text-muted hover:text-text-primary"
          >
            {{ link.label }}
          </Link>
        </div>
      </div>
    </div>
    <div
      class="flex flex-wrap justify-between gap-2 border-t border-hairline pt-6 text-caption text-text-muted"
    >
      <span>{{ t('landing.footer.copyright') }}</span>
      <span class="inline-flex items-center gap-2 font-semibold">
        <span
          class="inline-block h-2.5 w-2.5 rounded-full"
          style="background: var(--gradient-brand)"
        />
        {{ t('landing.footer.domain') }}
      </span>
    </div>
  </footer>
</template>
