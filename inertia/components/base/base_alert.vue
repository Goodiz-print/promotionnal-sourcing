<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from 'lucide-vue-next'
import type { BadgeTone } from '~/types/ui'

/** Encart d'information (callout) par tonalité, avec icône et titre optionnel. */
const props = withDefaults(
  defineProps<{
    tone?: BadgeTone
    title?: string
  }>(),
  { tone: 'info', title: '' }
)

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'border-hairline bg-sunken text-text-primary',
  info: 'border-indigo-100 bg-info-bg text-indigo-800',
  success: 'border-success/20 bg-success-bg text-success',
  warning: 'border-warning/20 bg-warning-bg text-warning',
  danger: 'border-danger/20 bg-danger-bg text-danger',
}

const ICONS = {
  neutral: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: OctagonAlert,
} as const

const toneClass = computed(() => TONE_CLASSES[props.tone])
const icon = computed(() => ICONS[props.tone])
</script>

<template>
  <div :class="toneClass" class="flex gap-3 rounded-lg border p-4" role="status">
    <component :is="icon" :size="18" class="mt-0.5 shrink-0" aria-hidden="true" />
    <div class="flex min-w-0 flex-col gap-0.5 text-body-sm">
      <p v-if="title" class="font-semibold">{{ title }}</p>
      <div><slot /></div>
    </div>
  </div>
</template>
