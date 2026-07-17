import { inject } from '@adonisjs/core'
import Organization from '#models/organization'
import CloudinaryService from '#services/cloudinary_service'
import type { UpdateOrganizationSettingsData } from '#shared/types/organization'
import type { MultipartFile } from '@adonisjs/core/bodyparser'

/**
 * Logique métier des paramètres généraux de l'organisation. Upload/suppression
 * du logo délégués à CloudinaryService (injecté pour la testabilité, cf.
 * SupplierProductService).
 */
@inject()
export default class OrganizationService {
  constructor(private cloudinary: CloudinaryService) {}

  /**
   * Met à jour les champs texte de l'organisation (slug et logo exclus : gérés
   * ailleurs).
   */
  async update(
    organization: Organization,
    data: UpdateOrganizationSettingsData
  ): Promise<Organization> {
    organization.merge(data)
    await organization.save()
    return organization
  }

  /**
   * Upload le nouveau logo sur Cloudinary, persiste `logoUrl`/`logoPublicId`,
   * puis supprime l'ancien asset s'il existait (remplacement).
   */
  async updateLogo(organization: Organization, file: MultipartFile): Promise<Organization> {
    const previousPublicId = organization.logoPublicId
    const asset = await this.cloudinary.upload(file, `organizations/${organization.slug}`)

    organization.merge({ logoUrl: asset.secureUrl, logoPublicId: asset.publicId })
    await organization.save()

    if (previousPublicId) {
      await this.cloudinary.destroy(previousPublicId)
    }
    return organization
  }

  /**
   * Retire le logo courant (sans remplacement) : nettoie l'asset Cloudinary et
   * remet `logoUrl`/`logoPublicId` à `null`.
   */
  async removeLogo(organization: Organization): Promise<Organization> {
    if (organization.logoPublicId) {
      await this.cloudinary.destroy(organization.logoPublicId)
    }
    organization.merge({ logoUrl: null, logoPublicId: null })
    await organization.save()
    return organization
  }
}
