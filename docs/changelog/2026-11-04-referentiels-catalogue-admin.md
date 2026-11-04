# Referentiels catalogue - Administration backend

> Date : 2026-11-04

Implementation backend de l'issue #165 : administration des referentiels catalogue (certifications, techniques de marquage, attributs par categorie).

## Routes ajoutees

### Certifications (admin plateforme)

- `GET /:locale/admin/certifications` - Liste des certifications (admin.certifications.index)
- `GET /:locale/admin/certifications/create` - Formulaire creation (admin.certifications.create)
- `POST /:locale/admin/certifications` - Creation (admin.certifications.store)
- `GET /:locale/admin/certifications/:id/edit` - Formulaire edition (admin.certifications.edit)
- `PATCH /:locale/admin/certifications/:id` - Mise a jour (admin.certifications.update)
- `DELETE /:locale/admin/certifications/:id` - Suppression (admin.certifications.destroy)

### Techniques de marquage (admin plateforme)

- `GET /:locale/admin/marking-techniques` - Liste (admin.marking_techniques.index)
- `GET /:locale/admin/marking-techniques/create` - Formulaire creation (admin.marking_techniques.create)
- `POST /:locale/admin/marking-techniques` - Creation (admin.marking_techniques.store)
- `GET /:locale/admin/marking-techniques/:id/edit` - Formulaire edition (admin.marking_techniques.edit)
- `PATCH /:locale/admin/marking-techniques/:id` - Mise a jour (admin.marking_techniques.update)
- `DELETE /:locale/admin/marking-techniques/:id` - Suppression (admin.marking_techniques.destroy)

### Attributs par categorie (admin plateforme)

- `POST /:locale/admin/categories/:categoryId/attributes` - Ajout attribut (admin.category_attributes.store)
- `PATCH /:locale/admin/category-attributes/:id` - Mise a jour pivot (admin.category_attributes.update)
- `DELETE /:locale/admin/category-attributes/:id` - Suppression pivot (admin.category_attributes.destroy)
- `PATCH /:locale/admin/category-attributes/:id/ranges` - MAJ plages numeriques (admin.category_attributes.ranges)

## Services

- `CertificationService` : CRUD certifications, traductions auto, audit, reindexation produits si `is_eco` change
- `MarkingTechniqueService` : CRUD techniques, traductions auto, audit
- `CategoryAttributeService` : gestion pivot `category_attributes` et plages `category_attribute_ranges`

## Types ajoutes

- `shared/types/certification.ts` : `CertificationAdminType`, `CertificationEditType`, `CreateCertificationData`, `UpdateCertificationData`
- `shared/types/marking.ts` : `MarkingTechniqueAdminType`, `MarkingTechniqueEditType`, `CreateMarkingTechniqueData`, `UpdateMarkingTechniqueData`
- `shared/types/category.ts` : types admin pour attributs de categorie
- `shared/types/ai.ts` : ajout `certification` et `marking_technique` dans `TRANSLATABLE_ENTITIES`

## Exceptions

- `CertificationInUseException` : suppression refusee si produits lies (HTTP 409)
- `MarkingTechniqueInUseException` : suppression refusee si produits lies (HTTP 409)
- `CategoryAttributeAlreadyExistsException` : ajout doublon refuse (HTTP 409)

## Audit

Actions ajoutees au journal d'audit admin :

- `certification.created`, `certification.updated`, `certification.deleted`
- `marking_technique.created`, `marking_technique.updated`, `marking_technique.deleted`
- `category_attribute.added`, `category_attribute.updated`, `category_attribute.removed`

## Traductions

- Ajout `certifications.json` et `markingTechniques.json` pour les 9 langues
- Mise a jour `admin.json` (nav + audit) pour les 9 langues

## Effets de bord

- Modification de `is_eco` sur une certification : reindexation des produits concernes (via `SearchSyncService.queueProduct`)
- Suppression de certification/technique : refusee si utilisee par des produits
