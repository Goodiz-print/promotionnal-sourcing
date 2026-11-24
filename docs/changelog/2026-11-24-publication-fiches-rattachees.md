# Seules les fiches fournisseur rattachées sont publiées

> Date : 2026-11-24

> ⚠️ **Ne pas déployer avant que les fiches importées soient rattachées à leurs
> fournisseurs.** À la mise en production, tous les produits des fiches sans
> organisation sortent du catalogue, de la recherche et de l'index. Rattacher
> d'abord, depuis `/admin/supplier-links`, les fournisseurs qui ont donné leur
> accord, puis déployer et lancer `node ace search:remove-unlinked`.

Retour client du 16/11/2026 (#240) : un fournisseur n'a ses produits sur la
plateforme qu'avec son accord, et il a alors un compte. Une fiche fournisseur
et ses produits ne sont donc publiés que si la fiche est **rattachée à une
organisation** ni archivée ni rejetée par la modération. Remplace #218.

- **Catalogue et annuaire** : les scopes `Supplier.fromLiveOrganization` et
  `Product.fromLiveOrganization` exigent une organisation vivante (`whereHas`)
  au lieu d'exclure seulement les organisations archivées ou rejetées. Une fiche
  importée sans organisation n'apparaît plus dans la liste des produits, la
  recherche, l'annuaire, ni sur `/:locale/products/:slug` ou
  `/:locale/suppliers/:slug` (404). Elle reste en base et dans le back-office.
- **Index Meilisearch** : les produits d'une fiche non rattachée ne sont plus
  indexés. Nouvelle commande `node ace search:remove-unlinked`
  (`ProductIndexService#removeUnlinkedProducts`) qui les retire de l'index par
  lots, sans recalculer de document ; sûre à relancer, sans effet sans
  `MEILISEARCH_HOST`. Ensuite, rattacher une fiche (#231) la publie et
  réindexe ses produits, la détacher les retire.
- **Traductions** : le rattrapage (`translation:backfill`) ne traite que les
  produits publiés, donc jamais ceux d'une fiche non rattachée. Rattacher une
  fiche met désormais en file la traduction de ses seuls produits
  (`TranslationQueueService#queueSupplier` → `TranslationBackfillJob` avec
  `supplierId`, nouvelle option `TranslationBackfillOptions.supplierId`), après
  le commit. Un échec de la file est loggué sans faire échouer le rattachement.
  `TranslationBackfillService` est réécrit sans boucle (parcours récursifs :
  les mises en file restent séquentielles pour s'arrêter au premier refus de la
  file) ; calculs purs dans `shared/helpers/translation_backfill.ts`.
- **Panier de devis** : le groupe « Fournisseurs non joignables » disparaît.
  Seules les lignes dont le produit est publié sont listées, comptées dans la
  pastille et validées ; chaque groupe a une organisation destinataire
  (`QuoteCartGroupType.supplierOrganizationId: number`). Une ligne dépubliée
  après l'ajout est masquée et réapparaît si le produit est republié. Clés
  `quote_cart.group.unreachable` et `unreachableDescription` supprimées des
  9 langues. La validation verrouille (`FOR SHARE`) les fiches des lignes
  envoyées et refuse la validation si l'une a été détachée entre la lecture du
  panier et l'envoi (`QuoteCartChangedException`, message « Un fournisseur n'est
  plus joignable ») : un détachement concurrent attend la fin de la validation.
- **Back-office** : nouveau compteur « Fiches à rattacher » sur le tableau de
  bord (`stats.pendingSupplierLinks`, `AdminSupplierLinkService#pendingCount`),
  lien vers `/admin/supplier-links`, montré aux rôles qui ont
  `organizations.manage` (ability `hasPlatformPermission`). L'écran des fiches
  en attente rappelle qu'elles ne sont pas publiées
  (`admin.supplierLinks.unpublishedNotice`, 9 langues).
- **Seed** : `nordic-promo` et `iberia-gifts` sont rattachées à leur propre
  organisation fournisseur (`nordic-promo-org`, `iberia-gifts-org`), pour que
  le catalogue de démonstration reste publié.
- **Tests** : `tests/functional/supplier_publication.spec.ts` (catalogue,
  URLs publiques, rattacher / détacher, recherche, synchronisation,
  `removeUnlinkedProducts`, commande, compteur, traduction au rattachement),
  `quote_cart.spec.ts` (ligne masquée puis rétablie, fiche détachée pendant la
  validation), `admin_supplier_links.spec.ts`, `translation_backfill.spec.ts`
  (`supplierId`, plusieurs lots, limite à cheval sur deux lots, refus en
  cours de lot ou sur le deuxième type, demande vide, payload du job),
  `tests/unit/translation_backfill.spec.ts`, `organization_lifecycle.spec.ts` (annuaire),
  `tests/inertia/admin_supplier_links.spec.ts` et `quote_cart.spec.ts`.
- Docs : `docs/search.md` (« Fiches non rattachées »), `docs/quote-cart.md`,
  `docs/comptes-fournisseurs-agences.md`, `docs/organisations.md`.
