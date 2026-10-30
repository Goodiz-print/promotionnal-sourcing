<script setup lang="ts">
import type { ContentLocale } from '#shared/types/i18n'

/**
 * Drapeau de la langue en SVG inline (les emojis drapeaux ne s'affichent pas sous
 * Windows). Décoratif : le nom de la langue est toujours affiché à côté.
 */
defineProps<{ code: ContentLocale }>()
</script>

<template>
  <svg
    viewBox="0 0 24 16"
    width="20"
    height="14"
    class="inline-block shrink-0 rounded-[2px] ring-1 ring-black/10"
    aria-hidden="true"
    focusable="false"
  >
    <template v-if="code === 'fr'">
      <rect width="8" height="16" fill="#0055A4" />
      <rect x="8" width="8" height="16" fill="#fff" />
      <rect x="16" width="8" height="16" fill="#EF4135" />
    </template>
    <template v-else-if="code === 'en'">
      <rect width="24" height="16" fill="#012169" />
      <path d="M0 0 24 16M24 0 0 16" stroke="#fff" stroke-width="3.2" />
      <path d="M0 0 24 16M24 0 0 16" stroke="#C8102E" stroke-width="1.2" />
      <path d="M12 0v16M0 8h24" stroke="#fff" stroke-width="5.3" />
      <path d="M12 0v16M0 8h24" stroke="#C8102E" stroke-width="3.2" />
    </template>
    <template v-else-if="code === 'de'">
      <rect width="24" height="5.34" fill="#000" />
      <rect y="5.33" width="24" height="5.34" fill="#DD0000" />
      <rect y="10.66" width="24" height="5.34" fill="#FFCE00" />
    </template>
    <template v-else-if="code === 'es'">
      <rect width="24" height="16" fill="#AA151B" />
      <rect y="4" width="24" height="8" fill="#F1BF00" />
    </template>
    <template v-else-if="code === 'it'">
      <rect width="8" height="16" fill="#009246" />
      <rect x="8" width="8" height="16" fill="#fff" />
      <rect x="16" width="8" height="16" fill="#CE2B37" />
    </template>
    <template v-else-if="code === 'nl'">
      <rect width="24" height="5.34" fill="#AE1C28" />
      <rect y="5.33" width="24" height="5.34" fill="#fff" />
      <rect y="10.66" width="24" height="5.34" fill="#21468B" />
    </template>
    <template v-else-if="code === 'pt'">
      <rect width="24" height="16" fill="#FF0000" />
      <rect width="9.6" height="16" fill="#006600" />
      <circle cx="9.6" cy="8" r="3" fill="#FFCC00" />
      <circle cx="9.6" cy="8" r="1.6" fill="#FF0000" />
    </template>
    <template v-else-if="code === 'pl'">
      <rect width="24" height="8" fill="#fff" />
      <rect y="8" width="24" height="8" fill="#DC143C" />
    </template>
    <template v-else-if="code === 'sv'">
      <rect width="24" height="16" fill="#006AA7" />
      <rect x="7" width="3.6" height="16" fill="#FECC02" />
      <rect y="6.2" width="24" height="3.6" fill="#FECC02" />
    </template>
    <!-- Langues sans drapeau dédié : pastille neutre (le nom reste affiché à côté). -->
    <rect v-else width="24" height="16" fill="#9CA3AF" />
  </svg>
</template>
