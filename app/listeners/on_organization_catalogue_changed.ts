import { inject } from '@adonisjs/core'
import SearchSyncService from '#services/search_sync_service'
import type OrganizationCatalogueChanged from '#events/organization_catalogue_changed'

/**
 * Met en queue la synchronisation de l'index de recherche pour tout le catalogue
 * de l'organisation (no-op sans `MEILISEARCH_HOST`).
 */
@inject()
export default class OnOrganizationCatalogueChanged {
  constructor(private sync: SearchSyncService) {}

  async handle({ organizationId }: OrganizationCatalogueChanged) {
    await this.sync.queueOrganization(organizationId)
  }
}
