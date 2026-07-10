import SupplierProfile from '#models/supplier_profile'
import type { UpdateSupplierProfileData } from '#shared/types/organization'

/**
 * Logique métier du profil fournisseur. Toute requête ORM vit ici : les
 * controllers restent fins (cf. CLAUDE.md, pas de `Model.query()` en controller).
 */
export default class SupplierProfileService {
  /**
   * Retourne le profil de l'organisation, ou `null` s'il n'existe pas encore.
   */
  getForOrganization(organizationId: number): Promise<SupplierProfile | null> {
    return SupplierProfile.findBy('organizationId', organizationId)
  }

  /**
   * Crée ou met à jour le profil de l'organisation (un profil par organisation).
   */
  upsertForOrganization(
    organizationId: number,
    data: UpdateSupplierProfileData
  ): Promise<SupplierProfile> {
    return SupplierProfile.updateOrCreate({ organizationId }, data)
  }
}
