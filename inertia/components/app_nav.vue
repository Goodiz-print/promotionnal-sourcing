<script setup lang="ts">
import { computed, type Component } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import {
  Boxes,
  Building2,
  FolderTree,
  Gavel,
  ScrollText,
  Search,
  SlidersHorizontal,
  FileCheck,
  FileText,
  Factory,
  Inbox,
  LayoutDashboard,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
  Users,
} from 'lucide-vue-next'
import type { Data } from '@generated/data'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import { useAdminTabs } from '~/composables/use_admin_tabs'
import { isActivePath } from '#shared/helpers/navigation'
import { ICON_SIZE } from '~/types/ui'

/**
 * Menu applicatif (sidebar) alimenté par la prop partagée `navigation`, calculée
 * côté serveur selon le type d'organisation et le rôle. Le front ajoute l'icône
 * et le groupe de chaque entrée, puis affiche les groupes non vides dans l'ordre.
 * `collapsed` (≥ md) réduit le menu à ses icônes : libellés masqués mais lus par les
 * lecteurs d'écran, titre de groupe remplacé par un filet.
 */
type NavGroup = 'explore' | 'buying' | 'supplier' | 'organization' | 'admin'

const GROUP_ORDER: NavGroup[] = ['explore', 'buying', 'supplier', 'organization', 'admin']

const NAV_META: Record<string, { icon: Component; group: NavGroup }> = {
  dashboard: { icon: LayoutDashboard, group: 'explore' },
  catalogue: { icon: Package, group: 'explore' },
  suppliers: { icon: Factory, group: 'explore' },
  rfqs: { icon: FileText, group: 'buying' },
  orders: { icon: ShoppingCart, group: 'buying' },
  supplierProducts: { icon: Boxes, group: 'supplier' },
  supplierRfqs: { icon: Inbox, group: 'supplier' },
  supplierQuotes: { icon: FileCheck, group: 'supplier' },
  supplierOrders: { icon: Truck, group: 'supplier' },
  supplierProfile: { icon: Store, group: 'supplier' },
  members: { icon: Users, group: 'organization' },
  settings: { icon: Settings, group: 'organization' },
  admin: { icon: ShieldCheck, group: 'admin' },
}

/** Icône de chaque section du back-office (clés de `useAdminTabs`). */
const ADMIN_ICONS: Record<string, Component> = {
  dashboard: LayoutDashboard,
  organizations: Building2,
  users: Users,
  categories: FolderTree,
  attributes: SlidersHorizontal,
  moderation: Gavel,
  agencies: Store,
  rfqs: FileText,
  quotes: FileCheck,
  orders: ShoppingCart,
  demand: Search,
  audit: ScrollText,
}

const props = withDefaults(defineProps<{ collapsed?: boolean }>(), { collapsed: false })

const page = usePage<Data.SharedProps>()
const { t, locale } = useI18n()

/**
 * Le back-office sert à administrer la plateforme : le menu y est remplacé par ses
 * sections (celles que le rôle plateforme permet), à la place des entrées acheteur,
 * fournisseur et agence.
 */
const inBackOffice = computed(() => page.component.startsWith('admin/'))
const { items: adminItems } = useAdminTabs()

const groups = computed(() => {
  if (inBackOffice.value) {
    const items = adminItems.value.map((item) => ({
      key: item.key,
      href: item.href,
      active: item.active,
      label: item.label,
      icon: ADMIN_ICONS[item.key] ?? ShieldCheck,
    }))
    return [{ key: 'admin' as NavGroup, label: t('common.nav.groups.admin'), items }]
  }
  const items = (page.props.navigation ?? []).map((item) => {
    const href = urlFor(item.route, { locale: locale.value })
    const meta = NAV_META[item.key] ?? { icon: Package, group: 'explore' as NavGroup }
    return {
      key: item.key,
      href,
      active: isActivePath(page.url, href),
      label: t(item.labelKey),
      icon: meta.icon,
      group: meta.group,
    }
  })
  return GROUP_ORDER.map((group) => ({
    key: group,
    label: t(`common.nav.groups.${group}`),
    items: items.filter((item) => item.group === group),
  })).filter((group) => group.items.length > 0)
})
</script>

<template>
  <nav :aria-label="t('common.nav.main')" class="flex flex-col gap-6">
    <div v-for="group in groups" :key="group.key" class="flex flex-col gap-1">
      <p
        v-if="groups.length > 1"
        class="mb-1 px-3 text-eyebrow text-text-muted"
        :class="props.collapsed ? 'md:sr-only' : ''"
      >
        {{ group.label }}
      </p>
      <div
        v-if="groups.length > 1 && props.collapsed"
        class="mx-3 mb-1 hidden border-t border-hairline md:block"
        aria-hidden="true"
      />
      <Link
        v-for="item in group.items"
        :key="item.key"
        :href="item.href"
        :aria-current="item.active ? 'page' : undefined"
        :title="props.collapsed ? item.label : undefined"
        class="flex items-center gap-3 rounded-md px-3 py-2 text-body-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        :class="[
          item.active
            ? 'bg-brand-subtle text-indigo-600'
            : 'text-text-secondary hover:bg-ink-100/70 hover:text-text-primary',
          props.collapsed ? 'md:justify-center md:px-0' : '',
        ]"
      >
        <component
          :is="item.icon"
          :size="ICON_SIZE"
          class="shrink-0"
          :class="item.active ? 'text-indigo-600' : 'text-text-muted'"
          aria-hidden="true"
        />
        <span :class="props.collapsed ? 'md:sr-only' : ''">{{ item.label }}</span>
      </Link>
    </div>
  </nav>
</template>
