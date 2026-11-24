# Consultations des produits dans l'espace fournisseur

> Date : 2026-11-24

Issue #239 (suivi #234). Un fournisseur voit combien de fois les agences ont
consulté ses produits et sa fiche ; l'identité des agences est réservée aux
abonnés.

- **Route** : `GET /:locale/supplier/insights` (`supplier.insights.index`),
  page `supplier/insights/index`, entrée « Consultations » du menu fournisseur.
  Ability `canViewSupplierInsights` : organisation `supplier` ou `both`, rôles
  `owner`, `admin` et `manager` (ceux qui traitent déjà les demandes reçues).
- **Filtres** (query string, optionnels) : `period` en jours (`7`, `30` par
  défaut, `90`, `365`, aujourd'hui compris) et `page` du tableau des produits.
  Une valeur invalide est ignorée.
- **Pour tous** : consultations de produits, produits consultés, consultations
  de la fiche, ajouts à une demande de devis ; tableau de **tous** les produits
  (même jamais consultés), les plus consultés en tête, 50 par page, avec lien
  vers l'édition du produit. Une page au-delà de la dernière est ramenée à la
  dernière.
- **Abonné** (`SubscriptionService.isSubscribed`, évalué à chaque lecture) :
  agences ayant consulté un produit ou la fiche, avec le nombre de consultations, de produits consultés et la date de
  la dernière consultation. Seuls les événements de moins de 90 jours nomment
  une agence ; plus anciens (pseudonymisés), ils restent comptés dans les totaux.
  Seules les agences **validées** sont nommées (`buyer` ou `both`, non
  archivées, sans motif de revue en cours), comme pour l'équipe commerciale.
  100 agences au plus, la plus récente en tête ; l'écran le signale quand le
  plafond est atteint. Aucun identifiant d'organisation n'est exposé.
- **Non abonné** : la liste n'est **pas lue** (`report.agencies = null`) ; aucun
  nom ni identifiant d'agence n'est envoyé au navigateur. À la place, l'encart
  `subscription_upsell.vue` (#222), avec le bouton de souscription pour un
  owner/admin.
- **Cloisonnement** : seuls les événements visant les produits et les fiches de
  l'organisation courante sont lus.
- **Code** : `SupplierInsightsService` ; les briques de lecture des
  consultations (événements d'une période, comptage par cible, nom des cibles)
  sont extraites de `AdminDemandService` dans `ActivityAggregationService`, les
  calculs purs dans `shared/helpers/activity_event.ts` et
  `shared/helpers/pagination.ts`. L'encart d'abonnement est calculé par un seul
  helper, `subscriptionUpsell` (`shared/helpers/subscription.ts`), utilisé aussi
  par « Demandes reçues ».
- **Migration** `1794000000041` : index `activity_events (target_type,
target_id, created_at)`, qui remplace `(target_type, target_id)`. Les
  compteurs partent ainsi des produits du fournisseur au lieu de parcourir par
  date les événements de toute la plateforme.
- **Mention légale** : l'information des agences (CGU, politique de
  confidentialité) est rédigée dans #233 et doit être en ligne avant la mise en
  production.
- **Tests** : `tests/functional/supplier_insights.spec.ts` (droits, compteurs,
  période, cloisonnement, props d'un non abonné sans agence, liste d'un abonné,
  seuil de 90 jours), `tests/functional/supplier_insights_service.spec.ts`
  (services contre la base), `tests/unit/activity_event_helpers.spec.ts`,
  `tests/unit/navigation.spec.ts`, `tests/unit/subscription_upsell.spec.ts`,
  `tests/inertia/supplier_insights.spec.ts`.
