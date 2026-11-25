<script setup lang="ts">
import { nextTick, onMounted, ref, useId, watch } from 'vue'
import { CircleHelp, TriangleAlert } from 'lucide-vue-next'
import BaseButton from '~/components/base/base_button.vue'
import type { ConfirmTone } from '~/types/ui'

/**
 * Fenêtre de confirmation modale (`<dialog>` natif : focus piégé, fond inerte,
 * Échap). Composant de présentation : le parent pilote `open` et réagit à
 * `confirm` / `cancel` — Échap et clic sur le voile valent `cancel`. En `danger`,
 * le focus initial va sur « Annuler » pour qu'un Entrée réflexe ne détruise rien.
 */
const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    message: string
    confirmLabel: string
    cancelLabel: string
    tone?: ConfirmTone
  }>(),
  { tone: 'default' }
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()
const messageId = useId()

async function sync(open: boolean) {
  await nextTick()
  const element = dialog.value
  if (!element || element.open === open) return
  if (open) element.showModal()
  else element.close()
}

watch(() => props.open, sync)
onMounted(() => sync(props.open))

function onCancel(event: Event) {
  event.preventDefault()
  emit('cancel')
}

/** Un clic dont la cible est le `<dialog>` lui-même tombe sur le voile. */
function onBackdropClick(event: MouseEvent) {
  if (event.target === dialog.value) emit('cancel')
}
</script>

<template>
  <dialog
    ref="dialog"
    role="alertdialog"
    :aria-labelledby="titleId"
    :aria-describedby="messageId"
    class="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-hairline bg-card p-0 text-text-primary shadow-elevation-3 backdrop:bg-ink-950/40"
    @cancel="onCancel"
    @click="onBackdropClick"
  >
    <div class="flex flex-col gap-6 p-6">
      <div class="flex items-start gap-4">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-[10px]"
          :class="
            tone === 'danger' ? 'bg-danger-bg text-danger' : 'bg-brand-subtle text-indigo-600'
          "
          aria-hidden="true"
        >
          <TriangleAlert v-if="tone === 'danger'" :size="20" />
          <CircleHelp v-else :size="20" />
        </span>
        <div class="flex flex-col gap-1.5">
          <h2 :id="titleId" data-confirm-dialog="title" class="text-heading-md">{{ title }}</h2>
          <p :id="messageId" data-confirm-dialog="message" class="text-body-sm text-text-secondary">
            {{ message }}
          </p>
        </div>
      </div>
      <div class="flex flex-wrap justify-end gap-3">
        <BaseButton
          variant="secondary"
          data-confirm-dialog="cancel"
          :autofocus="tone === 'danger' || undefined"
          @click="emit('cancel')"
        >
          {{ cancelLabel }}
        </BaseButton>
        <BaseButton
          :variant="tone === 'danger' ? 'danger' : 'primary'"
          data-confirm-dialog="confirm"
          :autofocus="tone !== 'danger' || undefined"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </BaseButton>
      </div>
    </div>
  </dialog>
</template>
