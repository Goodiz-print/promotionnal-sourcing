<script setup lang="ts">
import { computed } from 'vue'
import { Head, usePage } from '@inertiajs/vue3'
import { useMarketing } from '~/composables/use_marketing'
import { LOCALE_PREFIX_PATTERN, SUPPORTED_LOCALES } from '#shared/types/i18n'
import { OG_IMAGE_LOCALES, OG_LOCALES } from '#shared/types/marketing'

const props = withDefaults(
  defineProps<{
    title: string
    description: string
    /** Origine publique du site (https://promotional-sourcing.eu), fournie par le contrôleur. */
    siteUrl: string
    noindex?: boolean
  }>(),
  { noindex: false }
)

const page = usePage()
const { t, locale } = useMarketing()

const BRAND = 'Promotional Sourcing.eu'

/** Chemin de la page sans préfixe de locale ni query : sert aux URLs hreflang. */
const slug = computed(() => page.url.split(/[?#]/)[0].replace(LOCALE_PREFIX_PATTERN, ''))
const urlFor = (lang: string) => `${props.siteUrl}/${lang}${slug.value}`
const canonical = computed(() => urlFor(locale.value))
const ogImage = computed(() => `${props.siteUrl}/og-${OG_IMAGE_LOCALES[locale.value]}.png`)
const robots = computed(() =>
  props.noindex
    ? 'noindex, follow'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
)

const structuredData = computed(() =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${props.siteUrl}#organization`,
        'name': BRAND,
        'url': props.siteUrl,
        // Identité de l'entité : stable d'une page à l'autre, contrairement à la description de page.
        'description': t('landing.org.description'),
        'logo': {
          '@type': 'ImageObject',
          '@id': `${props.siteUrl}#logo`,
          'url': `${props.siteUrl}/logo-schema.png`,
          'contentUrl': `${props.siteUrl}/logo-schema.png`,
          'width': 1200,
          'height': 630,
          'caption': BRAND,
        },
        'image': { '@id': `${props.siteUrl}#logo` },
        'email': 'contact@promotional-sourcing.eu',
        'address': {
          '@type': 'PostalAddress',
          'addressLocality': 'Bordeaux',
          'addressCountry': 'FR',
        },
        'areaServed': 'EU',
      },
      {
        '@type': 'WebSite',
        '@id': `${props.siteUrl}#website`,
        'url': props.siteUrl,
        'name': BRAND,
        'description': props.description,
        'inLanguage': OG_LOCALES[locale.value].replace('_', '-'),
        'publisher': { '@id': `${props.siteUrl}#organization` },
      },
    ],
  })
)
</script>

<template>
  <Head :title="title">
    <meta head-key="description" name="description" :content="description" />
    <meta head-key="robots" name="robots" :content="robots" />
    <link head-key="canonical" rel="canonical" :href="canonical" />
    <link
      v-for="code in SUPPORTED_LOCALES"
      :key="code"
      :head-key="`alt-${code}`"
      rel="alternate"
      :hreflang="code"
      :href="urlFor(code)"
    />
    <link head-key="alt-x" rel="alternate" hreflang="x-default" :href="urlFor('fr')" />
    <meta head-key="og:type" property="og:type" content="website" />
    <meta head-key="og:site_name" property="og:site_name" :content="BRAND" />
    <meta head-key="og:locale" property="og:locale" :content="OG_LOCALES[locale]" />
    <meta head-key="og:url" property="og:url" :content="canonical" />
    <meta head-key="og:title" property="og:title" :content="title" />
    <meta head-key="og:description" property="og:description" :content="description" />
    <meta head-key="og:image" property="og:image" :content="ogImage" />
    <meta head-key="og:image:secure_url" property="og:image:secure_url" :content="ogImage" />
    <meta head-key="og:image:type" property="og:image:type" content="image/png" />
    <meta head-key="og:image:width" property="og:image:width" content="1200" />
    <meta head-key="og:image:height" property="og:image:height" content="630" />
    <meta head-key="og:image:alt" property="og:image:alt" :content="t('landing.og.imageAlt')" />
    <meta head-key="twitter:card" name="twitter:card" content="summary_large_image" />
    <meta head-key="twitter:url" name="twitter:url" :content="canonical" />
    <meta head-key="twitter:title" name="twitter:title" :content="title" />
    <meta head-key="twitter:description" name="twitter:description" :content="description" />
    <meta head-key="twitter:image" name="twitter:image" :content="ogImage" />
    <meta
      head-key="twitter:image:alt"
      name="twitter:image:alt"
      :content="t('landing.og.imageAlt')"
    />
    <!-- Google veut un favicon carré multiple de 48 px ; les crawlers retombent sur les PNG. -->
    <link head-key="icon-48" rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png" />
    <link head-key="icon-96" rel="icon" type="image/png" sizes="96x96" href="/favicon-96.png" />
    <link
      head-key="apple-touch-icon"
      rel="apple-touch-icon"
      sizes="180x180"
      href="/apple-touch-icon.png"
    />
    <link head-key="manifest" rel="manifest" href="/site.webmanifest" />
    <!-- Un <script> ne peut pas figurer tel quel dans un template Vue : composant dynamique. -->
    <component :is="'script'" head-key="json-ld" type="application/ld+json">
      {{ structuredData }}
    </component>
  </Head>
</template>
