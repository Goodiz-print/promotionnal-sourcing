<script setup lang="ts">
import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import type { RfqDetailType } from '#shared/types/rfq'

/**
 * Prolongation de l'échéance d'une demande publiée ou échue. Ne change que la
 * date, jamais le besoin : c'est l'exception assumée à « seul un brouillon est
 * modifiable ». Sur une demande échue, la nouvelle date la rouvre.
 *
 * Le serveur reste seul juge (date passée, ou pas postérieure à l'actuelle) et
 * répond par un message flash.
 */
const props = defineProps<{ rfq: Pick<RfqDetailType, 'id' | 'status' | 'deadline'> }>()

const { t, locale } = useI18n()

const deadline = ref('')
const saving = ref(false)

function extend() {
  if (!deadline.value || saving.value) return
  saving.value = true
  router.patch(
    urlFor('rfqs.deadline.update', { locale: locale.value, id: props.rfq.id }),
    { deadline: deadline.value },
    {
      preserveScroll: true,
      onSuccess: () => (deadline.value = ''),
      onFinish: () => (saving.value = false),
    }
  )
}
</script>

<template>
  <section class="flex flex-col gap-3 rounded border border-[var(--gray-3)] p-4">
    <p v-if="rfq.status === 'expired'" class="text-sm text-[var(--gray-8)]" role="status">
      {{ t('rfq.deadline.expiredNotice') }}
    </p>
    <div class="flex flex-wrap items-end gap-3">
      <BaseInput
        id="rfq-extend-deadline"
        v-model="deadline"
        type="date"
        :label="t('rfq.deadline.label')"
      />
      <BaseButton variant="secondary" :disabled="!deadline || saving" @click="extend()">
        {{ t('rfq.deadline.extend') }}
      </BaseButton>
    </div>
  </section>
</template>
