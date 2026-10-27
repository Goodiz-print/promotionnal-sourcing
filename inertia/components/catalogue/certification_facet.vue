<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '~/i18n'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import { CERTIFICATION_DOMAINS } from '#shared/types/certification'
import type { CertificationFacetBarType, CertificationFacetType } from '#shared/types/certification'

const props = defineProps<{
  facet: CertificationFacetBarType
  selectedIds: number[]
}>()

const emit = defineEmits<{
  toggle: [certificationId: number, checked: boolean]
}>()

const { t } = useI18n()

// Avec des compteurs, on masque les labels à 0 (aucun produit dans le jeu
// courant) — sauf ceux déjà cochés, pour pouvoir les décocher. Sans compteur
// (moteur inerte), on affiche tout.
const visible = computed<CertificationFacetType[]>(() =>
  props.facet.certifications.filter(
    (certification) =>
      !props.facet.hasCounts ||
      certification.count === null ||
      certification.count > 0 ||
      props.selectedIds.includes(certification.id)
  )
)

// Regroupement par domaine (environnement, textile, social…), dans l'ordre fixe
// de l'enum ; on ne garde que les domaines ayant au moins un label visible.
const groups = computed(() =>
  CERTIFICATION_DOMAINS.map((domain) => ({
    domain,
    certifications: visible.value.filter((certification) => certification.domain === domain),
  })).filter((group) => group.certifications.length > 0)
)
</script>

<template>
  <section v-if="groups.length > 0" class="flex flex-col gap-4">
    <h2 class="text-sm font-medium">{{ t('products.index.certifications.title') }}</h2>

    <fieldset v-for="group in groups" :key="group.domain" class="flex flex-col gap-2">
      <legend class="mb-1 text-xs font-medium text-[var(--gray-6)] uppercase tracking-wide">
        {{ t(`products.index.certifications.domains.${group.domain}`) }}
      </legend>

      <BaseCheckbox
        v-for="certification in group.certifications"
        :id="`certification-${certification.id}`"
        :key="certification.id"
        :model-value="selectedIds.includes(certification.id)"
        @update:model-value="(checked) => emit('toggle', certification.id, checked)"
      >
        <span class="flex flex-1 items-center gap-2">
          <span class="flex-1">{{ certification.name ?? certification.slug }}</span>
          <span
            v-if="facet.hasCounts && certification.count !== null"
            class="text-xs text-[var(--gray-6)]"
          >
            {{ certification.count }}
          </span>
        </span>
      </BaseCheckbox>
    </fieldset>
  </section>
</template>
