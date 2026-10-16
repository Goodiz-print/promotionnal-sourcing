import { inject } from '@adonisjs/core'
import Category from '#models/category'
import CategoryTranslation from '#models/category_translation'
import TranslationQueueService from '#services/translation/translation_queue_service'
import { CONTENT_LOCALES } from '#shared/types/i18n'
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CategoryTranslationInput,
} from '#shared/types/category'
import type { ContentLocale } from '#shared/types/i18n'

/**
 * Gestion de la taxonomie (catégories) du catalogue. Toute la logique ORM vit
 * ici (controllers fins). Les catégories sont globales : ce service alimente
 * l'administration back-office (CRUD + arbre `parentId`).
 */
@inject()
export default class CategoryService {
  constructor(private translationQueue: TranslationQueueService) {}

  /**
   * Liste d'administration : catégories + parent (traduit) + nombre de produits
   * rattachés, triées par slug.
   */
  listForAdmin(): Promise<Category[]> {
    return Category.query()
      .preload('translations')
      .preload('parent', (parent) => parent.preload('translations'))
      .withCount('products')
      .orderBy('slug')
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
   * Crée une catégorie (slug fourni par l'admin) + ses traductions.
   */
  async create(data: CreateCategoryInput): Promise<Category> {
    const category = await Category.create({
      slug: data.slug,
      parentId: data.parentId ?? null,
      synonyms: data.synonyms ?? [],
    })
    await this.writeTranslations(category, data.translations)
    await this.translationQueue.queue('category', category.id, category.sourceLocale)
    return category
  }

  /**
   * Met à jour une catégorie (parent, synonymes, traductions). Le slug reste
   * inchangé.
   */
  async update(category: Category, data: UpdateCategoryInput): Promise<Category> {
    await category.merge({ parentId: data.parentId ?? null, synonyms: data.synonyms ?? [] }).save()
    await this.writeTranslations(category, data.translations)
    await this.translationQueue.queue('category', category.id, category.sourceLocale)
    return category
  }

  /**
   * Supprime une catégorie (les traductions partent en cascade DB).
   */
  async delete(category: Category): Promise<void> {
    await category.delete()
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

  private async writeTranslations(
    category: Category,
    translations: Record<ContentLocale, CategoryTranslationInput>
  ): Promise<void> {
    for (const locale of CONTENT_LOCALES) {
      const translation = translations[locale]
      if (!translation) continue
      await CategoryTranslation.updateOrCreate(
        { categoryId: category.id, locale },
        {
          name: translation.name,
          description: translation.description ?? null,
          isAuto: false,
          translationKey: null,
        }
      )
    }
  }
}
