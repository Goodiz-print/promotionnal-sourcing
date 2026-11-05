import type { AiCallStatus, TranslatableEntity } from '#shared/types/ai'

/** Fenêtre des totaux et du volume affichés sur l'écran « IA et traductions ». */
export const AI_OVERVIEW_DAYS = 30

/** Délai minimal entre deux rattrapages lancés depuis le back-office (minutes). */
export const AI_BACKFILL_COOLDOWN_MINUTES = 10

/** Taille d'une page de traductions automatiques à relire. */
export const AI_TRANSLATIONS_PER_PAGE = 25

/** Longueur maximale d'un champ corrigé à la main (description comprise). */
export const AI_TRANSLATION_MAX_LENGTH = 10_000

/** Statut d'une traduction : générée par l'IA ou saisie / corrigée à la main. */
export const AI_TRANSLATION_ORIGINS = ['auto', 'manual'] as const
export type AiTranslationOrigin = (typeof AI_TRANSLATION_ORIGINS)[number]

export type AdminAiTotals = {
  calls: number
  failed: number
  truncated: number
  promptTokens: number
  completionTokens: number
  /** Coût estimé sur la fenêtre ; `null` tant qu'aucun tarif n'est configuré. */
  estimatedCost: number | null
}

export type AdminAiDailyVolume = {
  /** Jour au format AAAA-MM-JJ. */
  day: string
  calls: number
  failed: number
  tokens: number
}

/** Couverture d'une langue : combien d'entités ont une traduction, et d'où elle vient. */
export type AdminAiCoverageRow = {
  locale: string
  total: number
  auto: number
  manual: number
}

export type AdminAiFailure = {
  id: number
  entity: TranslatableEntity | null
  entityId: number | null
  model: string
  status: AiCallStatus
  targetLocales: string[]
  error: string | null
  createdAt: string
}

export type AdminAiOverview = {
  /** `AI_TRANSLATION_ENABLED` : sans lui, le rattrapage est refusé. */
  enabled: boolean
  model: string
  promptVersion: number
  /** Tarif configuré (par million de tokens) ; `null` si non renseigné. */
  pricing: { input: number; output: number; currency: string } | null
  days: number
  totals: AdminAiTotals
  daily: AdminAiDailyVolume[]
  coverage: AdminAiCoverageRow[]
  failures: AdminAiFailure[]
}

export type AdminAiTranslationFilters = {
  entity: TranslatableEntity
  locale: string | null
  origin: AiTranslationOrigin | null
  /** Recherche partielle dans le texte traduit. */
  search: string | null
}

/** Un champ d'une traduction avec son texte source, pour la relecture. */
export type AdminAiTranslationField = {
  name: string
  source: string | null
  value: string | null
}

export type AdminAiTranslationRow = {
  entity: TranslatableEntity
  entityId: number
  locale: string
  sourceLocale: string
  isAuto: boolean
  fields: AdminAiTranslationField[]
  updatedAt: string
}

/** Ligne brute de la requête de relecture (snake_case). */
export type AdminAiTranslationDbRow = {
  entity_id: number
  locale: string
  source_locale: string
  is_auto: boolean
  updated_at: Date | string | null
  [field: string]: unknown
}

/** Résultat d'une demande de rattrapage. */
export type AiBackfillRequestResult = 'queued' | 'disabled' | 'too_soon'
