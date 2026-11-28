<script setup lang="ts" generic="T extends string">
import { computed, nextTick, ref } from 'vue'
import { Check, ChevronDown } from 'lucide-vue-next'
import BaseField from '~/components/base/base_field.vue'
import { useDismissable } from '~/composables/use_dismissable'
import { filterOptions, moveActiveIndex, type ChoiceOption } from '#shared/helpers/option_filter'

/**
 * Liste déroulante avec recherche, pour les longues listes (pays) : un bouton
 * ouvre un panneau avec un champ de recherche et les options filtrées. Clavier :
 * flèches, Entrée, Échap. `clearLabel` ajoute en tête une option qui émet `null`
 * (« Tous les pays »). Le `v-model` garde le type des valeurs (`T | null`).
 */
const props = withDefaults(
  defineProps<{
    id: string
    modelValue: T | null
    options: ChoiceOption<T>[]
    /** Texte du bouton quand rien n'est choisi. */
    placeholder: string
    /** Nom accessible et placeholder du champ de recherche. */
    searchLabel: string
    noResultsLabel: string
    clearLabel?: string
    label?: string
    hint?: string
    error?: string
    required?: boolean
    disabled?: boolean
  }>(),
  { clearLabel: '', label: '', hint: '', error: '', required: false, disabled: false }
)

const emit = defineEmits<{ 'update:modelValue': [value: T | null] }>()

interface Entry {
  value: T | null
  label: string
}

const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const search = ref<HTMLInputElement | null>(null)
const list = ref<HTMLElement | null>(null)
const { open, close } = useDismissable(root)
const query = ref('')
const active = ref(-1)

const listId = computed(() => `${props.id}-listbox`)
const selected = computed(() => props.options.find((option) => option.value === props.modelValue))
const buttonText = computed(() => selected.value?.label ?? props.modelValue ?? props.placeholder)

const entries = computed<Entry[]>(() => {
  const matches = filterOptions(props.options, query.value)
  const showClear = props.clearLabel !== '' && query.value.trim() === ''
  return showClear ? [{ value: null, label: props.clearLabel }, ...matches] : matches
})

const optionId = (index: number) => `${props.id}-option-${index}`

async function show() {
  if (props.disabled) return
  query.value = ''
  open.value = true
  active.value = Math.max(
    entries.value.findIndex((entry) => entry.value === props.modelValue),
    0
  )
  await nextTick()
  search.value?.focus()
  scrollToActive()
}

function hide() {
  close()
  trigger.value?.focus()
}

function pick(entry: Entry) {
  emit('update:modelValue', entry.value)
  hide()
}

function scrollToActive() {
  list.value?.querySelector(`#${optionId(active.value)}`)?.scrollIntoView?.({ block: 'nearest' })
}

function move(delta: number) {
  active.value = moveActiveIndex(active.value, delta, entries.value.length)
  scrollToActive()
}

function onQuery() {
  active.value = entries.value.length > 0 ? 0 : -1
}

function choose() {
  const entry = entries.value[active.value]
  if (entry) pick(entry)
}
</script>

<template>
  <BaseField :label="label" :html-for="id" :error="error" :hint="hint" :required="required">
    <template #default="{ errorId, hintId }">
      <div ref="root" class="relative">
        <button
          :id="id"
          ref="trigger"
          type="button"
          :disabled="disabled"
          aria-haspopup="listbox"
          :aria-expanded="open"
          :aria-controls="listId"
          :aria-invalid="error ? 'true' : undefined"
          :aria-describedby="error ? errorId : hint ? hintId : undefined"
          :data-invalid="error ? 'true' : undefined"
          class="field-control flex h-11 cursor-pointer items-center pr-10 text-left disabled:cursor-not-allowed"
          @click="open ? hide() : show()"
          @keydown.down.prevent="show"
        >
          <span class="truncate" :class="{ 'text-text-muted': modelValue === null }">
            {{ buttonText }}
          </span>
          <ChevronDown
            :size="16"
            class="pointer-events-none absolute right-3.5 text-text-muted"
            aria-hidden="true"
          />
        </button>

        <div
          v-show="open"
          class="absolute inset-x-0 top-full z-40 mt-1 flex flex-col gap-1 rounded-lg border border-hairline bg-card p-1 shadow-elevation-2"
        >
          <input
            ref="search"
            v-model="query"
            type="text"
            role="combobox"
            autocomplete="off"
            aria-autocomplete="list"
            :aria-expanded="open"
            :aria-controls="listId"
            :aria-activedescendant="active >= 0 ? optionId(active) : undefined"
            :aria-label="searchLabel"
            :placeholder="searchLabel"
            class="field-control h-9 py-1.5 text-body-sm"
            @input="onQuery"
            @keydown.down.prevent="move(1)"
            @keydown.up.prevent="move(-1)"
            @keydown.enter.prevent="choose"
            @keydown.esc.prevent="hide"
            @keydown.tab="close"
          />
          <ul :id="listId" ref="list" role="listbox" class="max-h-64 overflow-y-auto">
            <li
              v-for="(entry, index) in entries"
              :id="optionId(index)"
              :key="entry.value ?? ''"
              role="option"
              :data-value="entry.value ?? ''"
              :aria-selected="entry.value === modelValue"
              class="flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-body-sm text-text-primary"
              :class="{
                'bg-sunken': index === active,
                'font-semibold': entry.value === modelValue,
              }"
              @mousedown.prevent
              @mousemove="active = index"
              @click="pick(entry)"
            >
              <span class="truncate">{{ entry.label }}</span>
              <Check
                v-if="entry.value === modelValue"
                :size="14"
                class="shrink-0 text-text-secondary"
                aria-hidden="true"
              />
            </li>
            <li v-if="entries.length === 0" class="px-3 py-2 text-body-sm text-text-muted">
              {{ noResultsLabel }}
            </li>
          </ul>
        </div>
      </div>
    </template>
  </BaseField>
</template>
