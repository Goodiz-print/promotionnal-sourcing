<script setup lang="ts">
import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { urlFor } from '~/client'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import { useMarketing } from '~/composables/use_marketing'
import type { CategoryType } from '#shared/types/category'

defineProps<{ categories: CategoryType[] }>()

const { t, locale } = useMarketing()
const search = ref('')

/** Recherche catalogue : redirige vers `products.index?search=`. */
function submit() {
  const term = search.value.trim()
  router.get(urlFor('products.index', { locale: locale.value }), term ? { search: term } : {})
}
</script>

<template>
  <section class="px-6 py-14 md:px-10" data-testid="discover-section">
    <div class="mx-auto flex max-w-[860px] flex-col items-center gap-8 text-center">
      <form class="flex w-full flex-col gap-3 sm:flex-row" role="search" @submit.prevent="submit">
        <label class="sr-only" for="home-search">{{ t('landing.discover.searchLabel') }}</label>
        <input
          id="home-search"
          v-model="search"
          type="search"
          :placeholder="t('landing.discover.searchPlaceholder')"
          class="flex-1 rounded-pill border border-input bg-canvas px-6 py-3.5 text-body-md"
        />
        <button
          type="submit"
          class="font-heading cursor-pointer rounded-pill bg-indigo-500 px-7 py-3.5 text-body-md font-semibold text-white hover:bg-indigo-600"
        >
          {{ t('landing.discover.searchSubmit') }}
        </button>
      </form>

      <div class="flex flex-wrap justify-center gap-4">
        <BaseLinkButton size="lg" :href="urlFor('new_account.create', { locale })">
          {{ t('landing.discover.buyerCta') }}
        </BaseLinkButton>
        <BaseLinkButton
          size="lg"
          :href="urlFor('new_account.create', { locale })"
          variant="secondary"
        >
          {{ t('landing.discover.supplierCta') }}
        </BaseLinkButton>
      </div>

      <div v-if="categories.length > 0" class="w-full">
        <h2 class="mb-4 text-body-lg font-semibold">{{ t('landing.discover.categoriesTitle') }}</h2>
        <ul class="flex flex-wrap justify-center gap-3">
          <li v-for="category in categories" :key="category.id">
            <Link
              :href="`${urlFor('products.index', { locale })}?categoryId=${category.id}`"
              class="inline-block rounded-pill border border-hairline px-4 py-2 text-body-sm font-semibold text-text-secondary hover:border-indigo-300 hover:text-indigo-600"
            >
              {{ category.name ?? category.slug }}
            </Link>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
