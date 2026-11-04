import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import Category from '#models/category'
import CategoryTranslation from '#models/category_translation'
import AdminAuditService from '#services/admin_audit_service'
import TranslationQueueService from '#services/translation_queue_service'
import TranslationBackfillService from '#services/translation_backfill_service'
import { missingSourceTranslation } from '#exceptions/translation_errors'
import { compareSiblingCategories, orderCategoriesAsTree } from '#shared/helpers/category_tree'
import { CONTENT_LOCALES } from '#shared/types/i18n'
import type {
  CategoryMoveDirection,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '#shared/types/category'
import type { ContentLocale } from '#shared/types/i18n'
import type { AdminActionContext } from '#shared/types/admin_audit'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Gestion de la taxonomie (catégories) du catalogue. Toute la logique ORM vit
 * ici (controllers fins). Les catégories sont globales : ce service alimente
 * l'administration back-office (CRUD + arbre `parentId`).
 */
@inject()
export default class CategoryService {
  constructor(
    private translationQueue: TranslationQueueService,
    private audit: AdminAuditService,
    private backfill: TranslationBackfillService
  ) {}

  /**
   * Liste d'administration : catégories + parent (traduit) + nombre de produits
   * rattachés, dans l'ordre de l'arbre (parcours en profondeur, sœurs triées par
   * `position` puis slug). `$extras` porte `depth`, `can_move_up`, `can_move_down`.
   */
  async listForAdmin(): Promise<Category[]> {
    const all = await Category.query()
      .preload('translations')
      .preload('parent', (parent) => parent.preload('translations'))
      .withCount('products')

    return orderCategoriesAsTree(all).map(
      ({ category, depth, hasPreviousSibling, hasNextSibling }) => {
        category.$extras.depth = depth
        category.$extras.can_move_up = hasPreviousSibling
        category.$extras.can_move_down = hasNextSibling
        return category
      }
    )
  }

  /**
   * Met en file la traduction automatique de **toutes** les catégories vers les
   * langues manquantes. Idempotent : les langues déjà traduites (et les noms
   * saisis à la main) ne sont jamais retraités. Aucune écriture en base, donc
   * pas d'audit. `failed` = file indisponible.
   */
  async requestMissingTranslations(): Promise<{ queued: number; failed: boolean }> {
    const report = await this.backfill.backfill({ entities: ['category'] })
    return { queued: report.queued.category, failed: report.failed }
  }

  /**
   * Position suivante parmi les sœurs de `parentId` (ajout en fin de liste).
   * Pas de verrou : deux créations simultanées sous le même parent peuvent
   * obtenir la même position, sans conséquence — `move` renumérote les sœurs.
   */
  private async nextPosition(
    parentId: number | null,
    trx: TransactionClientContract
  ): Promise<number> {
    const query = trx.from('categories').max('position as max')
    if (parentId === null) query.whereNull('parent_id')
    else query.where('parent_id', parentId)
    const row = await query.first()
    return row?.max === null || row?.max === undefined ? 0 : Number(row.max) + 1
  }

  /**
   * Déplace la catégorie d'un cran parmi ses sœurs (même parent). Les sœurs sont
   * verrouillées (`FOR UPDATE`) puis renumérotées 0..n-1, ce qui répare aussi
   * d'éventuelles positions en doublon. Retourne `false` (sans écriture ni audit)
   * si la catégorie est déjà en bout de liste dans ce sens.
   */
  async move(
    category: Category,
    direction: CategoryMoveDirection,
    context: AdminActionContext
  ): Promise<boolean> {
    return db.transaction(async (trx) => {
      const siblingsQuery = Category.query({ client: trx }).forUpdate()
      if (category.parentId === null) siblingsQuery.whereNull('parentId')
      else siblingsQuery.where('parentId', category.parentId)
      // Tri en mémoire avec le comparateur de l'affichage (même ordre que la liste).
      const loaded = await siblingsQuery
      const siblings = loaded.sort(compareSiblingCategories)

      const index = siblings.findIndex((sibling) => sibling.id === category.id)
      const target = direction === 'up' ? index - 1 : index + 1
      if (index === -1 || target < 0 || target >= siblings.length) return false

      const previous = siblings.map((sibling) => sibling.id)
      ;[siblings[index], siblings[target]] = [siblings[target], siblings[index]]

      for (const [position, sibling] of siblings.entries()) {
        if (sibling.position === position) continue
        await sibling.useTransaction(trx).merge({ position }).save()
      }

      await this.audit.record(
        {
          action: 'category.reordered',
          targetType: 'category',
          targetId: category.id,
          changes: {
            before: { order: previous.join(',') },
            after: { order: siblings.map((sibling) => sibling.id).join(','), direction },
          },
        },
        { ...context, client: trx }
      )
      return true
    })
  }

  /**
   * Catégorie pour l'édition (traductions préchargées). `null` si introuvable.
   */
  findById(id: number): Promise<Category | null> {
    return Category.query().where('id', id).preload('translations').first()
  }

  /**
   * Parents assignables : toutes les catégories, sauf `excludeId` et ses
   * descendants (évite les cycles dans l'arbre). Sans `excludeId` (création),
   * toutes les catégories sont assignables.
   */
  async assignableParents(excludeId?: number): Promise<Category[]> {
    const all = await Category.query().preload('translations').orderBy('slug')
    if (excludeId === undefined) return all

    const banned = await this.descendantIds(excludeId)
    banned.add(excludeId)
    return all.filter((category) => !banned.has(category.id))
  }

  /**
   * Crée une catégorie (slug fourni par l'admin) + ses traductions saisies. Les
   * langues non saisies sont générées automatiquement à partir de la langue source.
   * Création et entrée d'audit partagent une transaction ; la traduction
   * automatique est mise en file une fois celle-ci validée.
   */
  async create(data: CreateCategoryInput, context: AdminActionContext): Promise<Category> {
    if (!data.translations[data.sourceLocale]) throw missingSourceTranslation(data.sourceLocale)

    const category = await db.transaction(async (trx) => {
      const created = await Category.create(
        {
          slug: data.slug,
          parentId: data.parentId ?? null,
          position: await this.nextPosition(data.parentId ?? null, trx),
          synonyms: data.synonyms ?? [],
          sourceLocale: data.sourceLocale,
        },
        { client: trx }
      )
      await this.writeTranslations(created, data.translations, trx)
      await this.audit.record(
        {
          action: 'category.created',
          targetType: 'category',
          targetId: created.id,
          changes: { after: { slug: created.slug, parentId: created.parentId } },
        },
        { ...context, client: trx }
      )
      return created
    })

    await this.translationQueue.queue('category', category.id, data.sourceLocale)
    return category
  }

  /**
   * Met à jour une catégorie (parent, synonymes, traductions). Partielle : seuls
   * les champs fournis sont modifiés. Le slug reste inchangé. Écritures et entrée
   * d'audit partagent une transaction.
   */
  async update(
    category: Category,
    data: UpdateCategoryInput,
    context: AdminActionContext
  ): Promise<Category> {
    const sourceLocale = (data.sourceLocale ?? category.sourceLocale) as ContentLocale
    const provided = data.translations?.[sourceLocale]
    if (!provided?.name) {
      const existing = await CategoryTranslation.query()
        .where('categoryId', category.id)
        .where('locale', sourceLocale)
        .first()
      if (!existing) throw missingSourceTranslation(sourceLocale)
    }

    const before = { parentId: category.parentId, sourceLocale: category.sourceLocale }

    await db.transaction(async (trx) => {
      category.useTransaction(trx)
      category.sourceLocale = sourceLocale
      if (data.parentId !== undefined && data.parentId !== category.parentId) {
        // Changement de parent : la catégorie passe en fin de liste de ses nouvelles
        // sœurs ; l'ancien parent garde un trou de position, sans effet (`move` renumérote).
        category.parentId = data.parentId
        category.position = await this.nextPosition(data.parentId, trx)
      }
      if (data.synonyms !== undefined) category.synonyms = data.synonyms
      await category.save()
      await this.writeTranslations(category, data.translations, trx)
      await this.audit.record(
        {
          action: 'category.updated',
          targetType: 'category',
          targetId: category.id,
          changes: {
            before,
            after: { parentId: category.parentId, sourceLocale: category.sourceLocale },
          },
        },
        { ...context, client: trx }
      )
    })

    await this.translationQueue.queue('category', category.id, sourceLocale)
    return category
  }

  /**
   * Supprime une catégorie (les traductions partent en cascade DB), avec son
   * entrée d'audit dans la même transaction.
   */
  async delete(category: Category, context: AdminActionContext): Promise<void> {
    await db.transaction(async (trx) => {
      await category.useTransaction(trx).delete()
      await this.audit.record(
        {
          action: 'category.deleted',
          targetType: 'category',
          targetId: category.id,
          changes: { before: { slug: category.slug, parentId: category.parentId } },
        },
        { ...context, client: trx }
      )
    })
  }

  /**
   * Vrai si la catégorie a au moins une sous-catégorie (suppression bloquée).
   */
  async hasChildren(category: Category): Promise<boolean> {
    const child = await Category.query().where('parentId', category.id).first()
    return child !== null
  }

  /**
   * Vrai si des produits sont rattachés (suppression bloquée).
   */
  async hasProducts(category: Category): Promise<boolean> {
    const product = await category.related('products').query().first()
    return product !== null
  }

  /**
   * Vrai si affecter `parentId` créerait un cycle : parent = la catégorie
   * elle-même ou l'un de ses descendants.
   */
  async wouldCycle(category: Category, parentId: number | null | undefined): Promise<boolean> {
    if (parentId === null || parentId === undefined) return false
    if (parentId === category.id) return true
    const descendants = await this.descendantIds(category.id)
    return descendants.has(parentId)
  }

  /**
   * IDs de tous les descendants de `rootId` (parcours de l'arbre en mémoire —
   * la taxonomie est petite).
   */
  private async descendantIds(rootId: number): Promise<Set<number>> {
    const all = await Category.query().select('id', 'parentId')
    const childrenByParent = new Map<number, number[]>()
    for (const category of all) {
      if (category.parentId === null) continue
      const siblings = childrenByParent.get(category.parentId) ?? []
      siblings.push(category.id)
      childrenByParent.set(category.parentId, siblings)
    }

    const result = new Set<number>()
    const stack = [rootId]
    while (stack.length > 0) {
      const current = stack.pop()!
      for (const child of childrenByParent.get(current) ?? []) {
        if (!result.has(child)) {
          result.add(child)
          stack.push(child)
        }
      }
    }
    return result
  }

  /**
   * Écrit les traductions **saisies** (`is_auto = false`). Une ligne inchangée
   * garde son marquage ; une langue absente du payload n'est pas touchée.
   */
  private async writeTranslations(
    category: Category,
    translations: UpdateCategoryInput['translations'],
    trx: TransactionClientContract
  ): Promise<void> {
    if (!translations) return
    for (const locale of CONTENT_LOCALES) {
      const translation = translations[locale]
      if (!translation) continue

      const existing = await CategoryTranslation.query({ client: trx })
        .where('categoryId', category.id)
        .where('locale', locale)
        .first()

      if (!existing) {
        if (!translation.name) continue
        await CategoryTranslation.create(
          {
            categoryId: category.id,
            locale,
            name: translation.name,
            description: translation.description ?? null,
            isAuto: false,
          },
          { client: trx }
        )
        continue
      }

      const name = translation.name ?? existing.name
      const description =
        translation.description === undefined ? existing.description : translation.description
      if (name === existing.name && description === existing.description) continue
      await existing.useTransaction(trx).merge({ name, description, isAuto: false }).save()
    }
  }
}
