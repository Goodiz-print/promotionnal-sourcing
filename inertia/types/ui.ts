/**
 * Types partagés des composants génériques (`inertia/components/base/`).
 * Frontend uniquement : les types échangés avec les controllers vivent dans `shared/types/`.
 */

/** Tonalité sémantique d'un badge, d'une alerte ou d'un point de statut. */
export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'

export type ButtonSize = 'sm' | 'md'

/** Classes communes aux boutons et liens-boutons (pill Manrope, focus ring indigo). */
export const BUTTON_BASE_CLASSES =
  'font-heading inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-pill font-semibold whitespace-nowrap transition-[background-color,color,border-color,transform,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:pointer-events-none disabled:opacity-50'

export const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-500 text-white hover:bg-indigo-600 active:scale-[0.97]',
  secondary:
    'border border-input bg-canvas text-text-primary hover:border-strong hover:bg-ink-50 active:scale-[0.97]',
  ghost: 'border border-indigo-200 text-indigo-600 hover:bg-indigo-50 active:scale-[0.97]',
  danger:
    'border border-danger text-danger hover:bg-danger-bg focus-visible:outline-danger active:scale-[0.97]',
  link: 'h-auto rounded-none px-0 text-indigo-600 hover:text-indigo-700 hover:underline',
}

export const BUTTON_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-body-sm',
  md: 'h-11 px-6 text-body-md',
}

/** Icône lucide-vue-next : taille par défaut d'un bouton / d'un item de menu. */
export const ICON_SIZE = 18
