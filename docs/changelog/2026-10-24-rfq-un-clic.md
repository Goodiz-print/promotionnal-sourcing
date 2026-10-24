# Demande de devis « en un clic » depuis le catalogue (#55)

> Date : 2026-10-24

- **Fiche produit** : bouton « Demander un devis » pour un acheteur connecté
  (`canCreateRfq`), qui ouvre `GET /:locale/rfqs/new?productId=` avec une ligne
  pré-remplie (désignation, catégorie, quantité minimale) et le fournisseur du
  produit pré-coché. Un visiteur anonyme est renvoyé vers la connexion puis
  ramené sur le formulaire. Un menu permet aussi d'ajouter le produit à un
  brouillon existant (`POST /:locale/rfqs/:id/items/from-product`,
  `rfqs.items.from_product`).
- **Sélecteur de produit** dans le formulaire de demande (création et édition
  d'un brouillon) : recherche dans le catalogue par partial reload Inertia
  (`productResults`), le fournisseur du produit choisi est proposé comme
  destinataire. Le formulaire conserve désormais le lien `productId` des lignes
  à l'enregistrement, et la liste des lignes renvoie vers la fiche produit.
- **Suppression d'un brouillon** : `DELETE /:locale/rfqs/:id` (`rfqs.destroy`),
  brouillon uniquement, avec confirmation.
- **Recherche à remplacer par Meilisearch (#112)** : le sélecteur utilise une
  recherche PostgreSQL provisoire (`ProductCatalogueService#lookupForRfq`). Voir
  `docs/rfq.md`, section « À remplacer par Meilisearch », pour ce qu'il faut
  conserver en la remplaçant.
- Tests : `tests/functional/rfq_one_click.spec.ts`, `tests/inertia/product_quote_actions.spec.ts`, `tests/inertia/rfq_product_picker.spec.ts`.
