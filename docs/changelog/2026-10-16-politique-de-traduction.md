# Politique de traduction : langue source et saisie manuelle (#75)

Date : 2026-10-16

- **Langue source** : `products.source_locale` et `categories.source_locale` (défaut `fr`). Le fournisseur saisit dans `sourceLocale` (`fr`, `en`, `de`… parmi les 32 langues de `TRANSLATION_LOCALES`) ; la traduction automatique part de cette langue.
- **Formulaire produit** : création avec `sourceLocale` (`fr` dans l'interface actuelle). Édition : la langue source ne change pas.
- **Validateurs** (`app/validators/supplier_product.ts`) : `createSupplierProductValidator` exige `sourceLocale` ; `updateSupplierProductValidator` n'accepte pas de langue source. Dans les deux cas, `translations` est un ensemble partiel : seules les langues envoyées sont écrites. La présence du contenu dans la langue source est vérifiée par le service (`MissingSourceContentException`, 422).
- **Saisie manuelle** : une langue saisie par le fournisseur est marquée `is_auto = false` (tables `product_translations` et `category_translations`) et sa clé d'idempotence est effacée. La traduction automatique ne l'écrase plus, même si le texte source change.
- **Traduction automatique** : les lignes générées portent `is_auto = true`. Un produit publié (`isActive`) ou une catégorie déclenche la traduction vers les autres langues de `TRANSLATION_LOCALES` à la sauvegarde.
- **Non traité** : recherche dans les 32 langues (dictionnaires et index, #84), traduction des attributs et valeurs (pas encore d'administration, #48), traduction rétroactive des produits existants, chiffrage du coût sur 1 000 produits.
