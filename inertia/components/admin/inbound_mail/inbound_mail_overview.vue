<script setup lang="ts">
import { AlertTriangle, CheckCircle2, Clock, Loader, MailX } from 'lucide-vue-next'
import type { Component } from 'vue'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseStat from '~/components/base/base_stat.vue'
import type { AdminInboundMailOverview } from '#shared/types/admin_inbound_mail'
import type { InboundMailStatus } from '#shared/types/inbound_mail'

/** Nombre de mails par état ; chaque tuile filtre la liste sur son état. */
const props = defineProps<{ overview: AdminInboundMailOverview }>()

const { t, locale } = useI18n()

/** Les états à traiter d'abord. */
const TILES: { status: InboundMailStatus; icon: Component }[] = [
  { status: 'failed', icon: AlertTriangle },
  { status: 'rejected', icon: MailX },
  { status: 'received', icon: Clock },
  { status: 'processing', icon: Loader },
  { status: 'processed', icon: CheckCircle2 },
]

const href = (status: InboundMailStatus) =>
  `${urlFor('admin.inbound_mail.index', { locale: locale.value })}?status=${status}`
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
    <BaseStat
      v-for="tile in TILES"
      :key="tile.status"
      :label="t(`admin.inboundMail.statuses.${tile.status}`)"
      :value="props.overview[tile.status]"
      :icon="tile.icon"
      :href="href(tile.status)"
    />
  </div>
</template>
