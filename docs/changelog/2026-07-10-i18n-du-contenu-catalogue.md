# i18n du contenu catalogue (multilingue, N langues)

> Date : 2026-07-10

Le **contenu** du catalogue devient multilingue (FR/EN, extensible à N langues), dans le modèle **et** la recherche. Tout le texte quitte les tables de base pour des **tables de traduction dédiées** ; les tables de base ne gardent que le neutre (ids, slugs, `value` canonique, `unit`, `synonyms`, prix, flags, `embedding`).

- **Tables de traduction** (migrations `…955`→`…959`) : `supplier_translations`, `category_translations`, `attribute_translations`, `attribute_value_translations`, `product_translations` — colonnes `<entity>_id` + `locale` + champs traduits (name/description, name, label), `unique(<entity>_id, locale)`.
- **FTS par langue** : `product_translations.search_vector` = colonne générée **immuable** via un `CASE` par locale (`french`/`english`/… sinon `simple`) + index GIN. Recherche plein-texte dans la bonne langue (`to_tsquery('english', …)` vs `to_tsquery('french', …)`).
- **Retrait du texte des tables de base** (migration `…960`) : drop de `name`/`description`/`label` (et de l'ancienne colonne générée FR `products.search_vector`). `down()` réversible best-effort.
- **`schema_rules.ts`** : `products.skipColumns=['embedding']`, `product_translations.skipColumns=['search_vector']`.
- **Config N langues** : `LOCALE_TSCONFIG` (`shared/types/i18n.ts`) mappe locale→config FTS (défaut `simple`) ; ajouter une langue = une entrée ici + une branche `WHEN` dans la migration.
- **Modèles** : `*_translation.ts` (belongsTo parent) + relation `@hasMany(() => XxxTranslation) translations` sur les 5 modèles de base.
- **Résolution localisée** : helper `shared/helpers/translations.ts` (`resolveTranslation(translations, locale, fallback=fr)`), réutilisé par les transformers.
- **Transformers locale-aware** : constructeur `(resource, locale)` ; `Xxx.transform(resource, ctx.i18n.locale)` sort `name`/`description`/`label` résolus (repli FR).
- **Types partagés** : `XxxTranslationType` ; `CreateXxxData` déplace les champs traduits dans `translations: Partial<Record<Locale, {…}>>`.
- **Seeders** : contenu de démo bilingue FR/EN (produits, catégories, attributs + valeurs, fournisseurs).
- **Tests** : `tests/unit/translations.spec.ts` (résolution + repli). Preuve SQL : contenu EN/FR, FTS par langue (`watercolor`→EN, `aquarelle`→FR), et le filtrage `ET` neutre inchangé (crayon+bleu → 2 crayons bleus).
- **À suivre (incrément 3)** : les validateurs `create/update` et les endpoints d'écriture seront adaptés au payload `translations` ; moteur de recherche locale-aware + embeddings Mistral + page Inertia consommant ces traductions.
