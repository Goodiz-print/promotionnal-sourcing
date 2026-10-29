import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Garde-fou du design system (docs/design-system.md, « Garde-fou ») : aucun
 * fichier du frontend ne doit porter de trace de l'ancien design. La landing
 * (`marketing/`) et les feuilles de style sont hors périmètre.
 */
const ROOT = join(__dirname, '..', '..', 'inertia')
const EXCLUDED = ['inertia/css', 'inertia/components/marketing', 'inertia/pages/marketing']

const FORBIDDEN: { label: string; pattern: RegExp }[] = [
  { label: 'alias legacy var(--gray-*)', pattern: /var\(--gray-/ },
  { label: 'alias legacy var(--primary-*)', pattern: /var\(--primary-/ },
  { label: 'alias legacy var(--color-primary*)', pattern: /var\(--color-primary/ },
  { label: 'var(--state-*) : utiliser text-danger / bg-success-bg…', pattern: /var\(--state-/ },
  { label: 'taille arbitraire text-[NNpx]', pattern: /\btext-\[\d+px\]/ },
  { label: 'tracking arbitraire', pattern: /\btracking-\[/ },
  {
    label: '`rounded` nu : préciser rounded-md / lg / xl / pill',
    pattern: /(^|["'\s])rounded(["'\s]|$)/m,
  },
  {
    label: 'couleur hex dans une classe',
    pattern: /\b(bg|text|border|outline)-\[#[0-9a-fA-F]{3,8}\]/,
  },
  { label: '<details> : utiliser BaseDropdown', pattern: /<details\b/ },
  { label: '<h1> à la main : utiliser BasePageHeader (ou AuthHeader)', pattern: /<h1\b/ },
  { label: '<table> à la main : utiliser BaseTable', pattern: /<table\b/ },
  { label: 'shadow-lg : utiliser shadow-elevation-*', pattern: /\bshadow-(sm|md|lg|xl|2xl)\b/ },
  { label: 'glyphe texte (☰ 🔔 ← → ✓ ✕) : utiliser lucide', pattern: /[☰🔔←→✓✕]/ },
  {
    label: 'taille Tailwind générique : utiliser text-caption / text-body-* / text-heading-*',
    pattern: /\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl)\b/,
  },
]

/* Exceptions assumées : les composants qui posent le gabarit lui-même (en-têtes, tableau) et deux tailles hors échelle (pastille 11px, chiffre de BaseStat 28px). */
const ALLOWED_ARBITRARY: Record<string, RegExp[]> = {
  'inertia/components/base/base_page_header.vue': [/<h1\b/],
  'inertia/components/auth/auth_header.vue': [/<h1\b/],
  'inertia/components/base/base_table.vue': [/<table\b/],
  'inertia/components/base/base_stat.vue': [/text-\[28px\]/],
  'inertia/components/base/base_tabs.vue': [/text-\[11px\]/],
  'inertia/components/notifications/notification_bell.vue': [/text-\[11px\]/],
}

function walk(dir: string, extensions = /\.(vue|ts)$/): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return walk(path, extensions)
    return extensions.test(entry) ? [path] : []
  })
}

function violations(file: string): string[] {
  const key = relative(join(ROOT, '..'), file).replaceAll('\\', '/')
  if (EXCLUDED.some((prefix) => key.startsWith(prefix))) return []
  const source = readFileSync(file, 'utf8')
  return FORBIDDEN.filter(({ pattern }) => {
    const match = source.match(pattern)
    if (!match) return false
    return !(ALLOWED_ARBITRARY[key] ?? []).some((allowed) => allowed.test(match[0]))
  }).map(({ label }) => `${key} : ${label}`)
}

describe('design system — aucune trace de l’ancien design', () => {
  it('ne laisse aucun motif interdit dans inertia/', () => {
    const found = walk(ROOT).flatMap(violations)
    expect(found, found.join('\n')).toEqual([])
  })

  it('ne définit plus aucun alias legacy dans les feuilles de style', () => {
    const css = walk(join(ROOT, 'css'), /\.css$/)
      .map((file) => [relative(ROOT, file), readFileSync(file, 'utf8')] as const)
      .filter(([, source]) =>
        /--gray-\d|--primary-\d|--color-primary|--primary-contrast/.test(source)
      )
      .map(([file]) => file)
    expect(css).toEqual([])
  })
})
