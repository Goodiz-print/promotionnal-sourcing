import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ImageSearchService from '#services/image_search_service'
import {
  ImageDescriptionFailedError,
  ImageSearchDisabledError,
  InvalidImageError,
} from '#exceptions/image_search_errors'
import { imageSearchValidator } from '#validators/image_search'
import { IMAGE_SEARCH_FLASH_KEY } from '#shared/types/image_search'

/**
 * Recherche par image : reçoit la photo, la fait décrire, puis redirige vers le
 * catalogue avec la description comme terme de recherche (modifiable par
 * l'acheteur). Réservé aux utilisateurs connectés (coût de l'appel IA).
 */
@inject()
export default class ProductImageSearchController {
  constructor(private imageSearch: ImageSearchService) {}

  async store({ request, response, session, i18n }: HttpContext) {
    const { image } = await request.validateUsing(imageSearchValidator)

    try {
      const { query } = await this.imageSearch.describe(image, i18n.locale)
      // Le terme voyage en flash : la page catalogue sait ainsi qu'il vient d'une photo.
      session.flash(IMAGE_SEARCH_FLASH_KEY, query)
      return response
        .redirect()
        .toRoute('products.index', { locale: i18n.locale }, { qs: { search: query } })
    } catch (error) {
      if (error instanceof ImageSearchDisabledError) {
        session.flash('error', i18n.t('products.imageSearch.disabled'))
      } else if (error instanceof InvalidImageError) {
        session.flash('error', i18n.t('products.imageSearch.invalid'))
      } else if (error instanceof ImageDescriptionFailedError) {
        session.flash('error', i18n.t('products.imageSearch.failed'))
      } else {
        throw error
      }
      return response.redirect().back()
    }
  }
}
