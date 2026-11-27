<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import GradientMesh from '~/components/marketing/gradient_mesh.vue'
import { Link } from '@adonisjs/inertia/vue'
import { useMarketing } from '~/composables/use_marketing'
import type { MarketingPage } from '#shared/types/marketing'

const props = defineProps<{
  /** Fichier de traduction du document : `legal` (mentions légales) ou `privacy`. */
  doc: 'legal' | 'privacy'
  /** Ids de section, dans l'ordre du document : alimentent le sommaire et la numérotation. */
  sectionIds: readonly string[]
  /** Variante du corps d'une section (id → clé, `body` par défaut). */
  bodyKeys?: Record<string, string>
}>()

const { t, path, email } = useMarketing()

const related = computed<{ page: MarketingPage; label: string }>(() =>
  props.doc === 'privacy'
    ? { page: 'legal', label: t('landing.footer.linkLegalMentions') }
    : { page: 'privacy', label: t('landing.footer.linkPrivacy') }
)

const sections = computed(() =>
  props.sectionIds.map((id, index) => ({
    id,
    number: String(index + 1).padStart(2, '0'),
    title: t(`${props.doc}.sections.${id}.title`),
    body: t(`${props.doc}.sections.${id}.${props.bodyKeys?.[id] ?? 'body'}`),
  }))
)

/* Section active du sommaire : on garde la première visible dans l'ordre du document,
   sinon l'ordre des entrées de l'observer ferait sauter le repère d'avant en arrière. */
const activeId = ref(props.sectionIds[0])
let observer: IntersectionObserver | null = null

onMounted(() => {
  const visible = new Set<string>()
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id)
        else visible.delete(entry.target.id)
      }
      const first = props.sectionIds.find((id) => visible.has(id))
      if (first) activeId.value = first
    },
    { rootMargin: '-100px 0px -65% 0px' }
  )
  props.sectionIds.forEach((id) => {
    const el = document.getElementById(id)
    if (el) observer?.observe(el)
  })
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <section class="relative overflow-hidden border-b border-hairline bg-sunken">
    <GradientMesh animated />
    <div class="wrapper relative z-10 py-14 md:py-20">
      <nav
        :aria-label="t('landing.legal.breadcrumbAria')"
        class="mb-6 flex flex-wrap items-center gap-2 text-caption text-text-muted"
      >
        <Link class="transition-colors hover:text-text-primary" :href="path()">
          {{ t('landing.legal.breadcrumbHome') }}
        </Link>
        <span aria-hidden="true">/</span>
        <span class="font-semibold text-text-secondary">{{ t(`${doc}.heading`) }}</span>
      </nav>

      <p class="anim-rise mb-3 text-eyebrow text-text-brand">{{ t(`${doc}.eyebrow`) }}</p>
      <h1 class="anim-rise mb-5 max-w-[18ch] text-display-lg" style="animation-delay: 0.06s">
        {{ t(`${doc}.heading`) }}
      </h1>
      <p
        class="anim-rise max-w-[640px] text-body-lg text-text-secondary"
        style="animation-delay: 0.12s"
      >
        {{ t(`${doc}.intro`) }}
      </p>

      <div class="anim-rise mt-8 flex flex-wrap items-center gap-3" style="animation-delay: 0.18s">
        <span
          class="inline-flex items-center gap-2 rounded-pill border border-hairline bg-canvas px-4 py-2 text-caption text-text-secondary shadow-elevation-1"
        >
          <svg
            aria-hidden="true"
            class="h-3.5 w-3.5 text-indigo-500"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <circle cx="8" cy="8" r="6.25" />
            <path d="M8 4.5V8l2.25 1.75" stroke-linecap="round" />
          </svg>
          {{ t('landing.legal.updatedOn') }}
          <strong class="font-semibold text-text-primary">{{ t(`${doc}.updatedAt`) }}</strong>
        </span>
        <a
          class="inline-flex items-center gap-2 rounded-pill border border-hairline bg-canvas px-4 py-2 text-caption text-text-secondary shadow-elevation-1 transition-colors hover:border-indigo-200 hover:text-text-brand"
          :href="`mailto:${email}`"
        >
          <svg
            aria-hidden="true"
            class="h-3.5 w-3.5 text-indigo-500"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <rect x="1.75" y="3.25" width="12.5" height="9.5" rx="1.5" />
            <path d="m2.5 4.5 5.5 4 5.5-4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ email }}
        </a>
      </div>
    </div>
  </section>

  <div class="wrapper grid gap-10 py-14 lg:grid-cols-[236px_minmax(0,1fr)] lg:gap-16 lg:py-20">
    <aside class="hidden lg:sticky lg:top-28 lg:block lg:self-start">
      <p class="mb-4 text-eyebrow text-text-muted">{{ t('landing.legal.tocTitle') }}</p>
      <ol class="border-l border-hairline">
        <li v-for="section in sections" :key="section.id">
          <a
            :href="`#${section.id}`"
            class="-ml-px flex gap-2 border-l-2 py-1.5 pl-4 text-body-sm transition-colors hover:text-text-primary"
            :class="
              activeId === section.id
                ? 'border-indigo-500 font-semibold text-text-primary'
                : 'border-transparent text-text-muted'
            "
            :aria-current="activeId === section.id ? 'true' : undefined"
          >
            <span class="text-tabular text-caption text-text-muted" aria-hidden="true">{{
              section.number
            }}</span>
            <span>{{ section.title }}</span>
          </a>
        </li>
      </ol>
    </aside>

    <div class="flex min-w-0 flex-col gap-5">
      <details class="rounded-xl border border-hairline bg-sunken px-5 py-4 lg:hidden">
        <summary class="cursor-pointer list-none text-eyebrow text-text-primary">
          <span class="flex items-center justify-between gap-3">
            {{ t('landing.legal.tocTitle') }}
            <svg
              aria-hidden="true"
              class="h-4 w-4 text-text-muted"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path d="m4 6 4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </summary>
        <ol class="mt-4 flex flex-col gap-2 border-t border-hairline pt-4">
          <li
            v-for="section in sections"
            :key="section.id"
            class="flex gap-2 text-body-sm text-text-secondary"
          >
            <span class="text-tabular text-caption text-text-muted" aria-hidden="true">{{
              section.number
            }}</span>
            <a class="hover:text-text-brand" :href="`#${section.id}`">{{ section.title }}</a>
          </li>
        </ol>
      </details>

      <section
        v-for="section in sections"
        :id="section.id"
        :key="section.id"
        class="scroll-mt-28 rounded-xl border border-hairline bg-card p-6 shadow-elevation-1 transition-shadow duration-300 hover:shadow-elevation-2 md:p-9"
      >
        <div class="mb-5 flex items-start gap-4">
          <span
            aria-hidden="true"
            class="text-tabular mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-subtle text-caption font-bold text-indigo-600"
          >
            {{ section.number }}
          </span>
          <h2 class="text-heading-lg">{{ section.title }}</h2>
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -- contenu statique de nos fichiers de traduction -->
        <div class="legal-prose" v-html="section.body" />
      </section>

      <div
        data-reveal
        class="relative mt-4 overflow-hidden rounded-xl p-8 text-white md:p-10"
        style="background: var(--gradient-brand)"
      >
        <div
          aria-hidden="true"
          class="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white opacity-[0.12] blur-[2px]"
        />
        <div class="relative z-10">
          <p class="mb-3 text-eyebrow text-white/70">{{ t('landing.legal.helpEyebrow') }}</p>
          <h2 class="mb-3 max-w-[24ch] text-display-md text-white">
            {{ t('landing.legal.helpHeading') }}
          </h2>
          <p class="mb-8 max-w-[52ch] text-body-md text-indigo-100">
            {{ t('landing.legal.helpBody') }}
          </p>
          <div class="flex flex-wrap items-center gap-x-7 gap-y-4">
            <BaseLinkButton size="lg" :href="path('contact')" variant="on-dark">
              {{ t('landing.legal.helpCta') }}
            </BaseLinkButton>
            <Link
              class="text-body-md font-semibold text-white underline decoration-white/40 underline-offset-4 transition-colors hover:decoration-white"
              :href="path(related.page)"
            >
              {{ related.label }} <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
