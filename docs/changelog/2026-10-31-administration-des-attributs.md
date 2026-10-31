# Administration des attributs et valeurs d'attributs

> Date : 2026-10-31

Solde de #48 : les facettes du catalogue (couleur, matière, grammage…) et leurs valeurs ne sont plus
modifiables qu'en seeder. Un admin plateforme les gère depuis le back-office, sans déploiement. Les
attributs reçoivent aussi le déclenchement de la traduction automatique attendu par #97.

- **Routes** (`/:locale/admin/...`, middleware `platformAdmin`, ability `canManageAttributes`) :
  `attributes` (`admin.attributes.{index,create,store,edit,update,destroy}`) et
  `attributes/:id/values` (`admin.attribute_values.{store,update,destroy}`). Onglet « Attributs » dans
  le back-office.
- **Service** : `AttributeService` crée, met à jour et supprime attributs et valeurs (transaction,
  traductions saisies en `is_auto = false`, mise en file de la traduction vers les autres langues).
- **Champs figés** : slug et type d'un attribut, slug d'une valeur.
- **Suppression refusée** si des produits utilisent l'attribut ou la valeur, si une catégorie a retenu
  l'attribut, ou si une famille de couleur a encore des nuances. Exceptions
  `AttributeInUseException` / `AttributeValueInUseException`, message affiché en flash.
- **Validateurs** : `app/validators/attribute.ts` suit désormais le payload `translations` (une entrée
  par langue de contenu, `sourceLocale` obligatoire), comme les catégories.
- **Front** : `admin/attributes/{index,create,edit}.vue`, formulaire `AttributeForm` (langue source +
  autre langue au choix), valeurs éditées en ligne (`AttributeValueForm`) pour les attributs de type
  liste de valeurs. Textes dans `resources/lang/*/attributes.json` (9 langues) et `admin.nav.attributes`.
- **Tests** : `tests/functional/admin_attributes.spec.ts` (CRUD, refus de suppression, cloisonnement
  admin plateforme / rôles d'organisation).
