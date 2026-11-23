# « Mes demandes » : avancement, devis reçus et devis PDF retenu

> Date : 2026-11-23

Issue #228. Côté agence, « Mes demandes » montre chaque demande avec son
avancement et tous les devis reçus, PDF ou structurés. Une demande appartient à
l'agence : tous ses membres voient toutes ses demandes.

- **Liste** (`GET /:locale/rfqs`, `rfqs.index`) :
  - regroupée par **lot de panier** (`rfqs.batch_id`, #229) : les demandes d'une
    même validation du panier sous une ligne « Panier du … · N demandes » ; une
    demande hors panier reste seule (`groupRfqsByBatch`, `shared/helpers/rfq_list.ts`) ;
  - **avancement lisible** par demande (`RfqProgress`) : brouillon, publiée
    (encore envoyée à personne), envoyée, répondue (au moins un destinataire a
    répondu), échue, clôturée — mêmes libellés que les statuts du détail ;
  - colonnes auteur, réponses et indicateur **« devis reçu »** (devis structuré
    remis ou devis PDF) ;
  - **filtres** par avancement et par auteur, dans la query string
    (`?status=responded&authorId=12`) : visite Inertia `preserveState`, URL
    partageable. Chaque filtre est validé séparément : une valeur invalide est
    ignorée sans faire tomber l'autre. Seuls les auteurs d'au moins une demande
    de l'agence sont proposés.
  - Props : `groups`, `filters`, `authors` (remplacent `rfqs`).
- **Service** : `RfqService#listForBuyer(organizationId, filters)` (colonnes
  explicites ; items, destinataires et auteur préchargés, une requête par
  relation ; devis remis et devis PDF seulement comptés en sous-requête,
  `withCount`) et `RfqService#authorsForBuyer`. `RfqService#close`
  accepte la transaction de l'appelant.
- **Détail** (`rfqs.show`) : nouvelle section **« Devis PDF reçus »** (prop
  `quoteDocuments`, `QuoteService#documentsForRfq(rfq)`, qui reprend les
  destinataires déjà chargés de la demande pour le nom du fournisseur) : fournisseur, fichier
  téléchargeable par la route réservée aux membres de l'agence
  (`quote_documents.download`, #225), date de réception, décision. Les devis
  structurés, le fil des échanges (#226) et les statuts expiré / réponse tardive
  par destinataire (#232) restent sur le même écran. L'état vide des devis
  structurés est masqué quand seuls des PDF sont arrivés.
- **Devis PDF « retenu »** : `POST /:locale/quote-documents/:id/select`
  (`quote_documents.select`, `QuoteDocumentsController#select`). Pose
  `quote_documents.selected_at` et **clôture la demande** dans une même
  transaction (`QuoteService#selectDocument`, demande relue sous verrou). Le
  devis est chargé sans ses fichiers (`QuoteService#findDocumentForDecision`).
  **Aucune commande** n'est créée : la suite se fait entre l'agence et le
  fournisseur. Réservé aux responsables de l'agence (ability
  `canSelectQuoteDocument`, `RFQ_MANAGER_ROLES`) ; une demande qui n'est plus
  ouverte devient un message flash. Confirmation avant envoi.
- **Migration** `1794000000040_add_selected_at_to_quote_documents` (avec `down()`).
- **i18n** : `rfq.index.{progress,filters,batch,…}` et `quote.documents.*` dans
  les 9 langues.
- **Tests** : `tests/functional/rfq_my_requests.spec.ts` (filtres, regroupement,
  accès refusé à une organisation fournisseuse et à une autre agence, devis PDF
  listés, « retenu » par manager et propriétaire, refusé à un membre simple, à
  une autre agence et au fournisseur, demande déjà close), specs unitaires de
  `rfq_list` et des transformers `RfqListItemTransformer`,
  `RfqAuthorOptionTransformer`, `QuoteDocumentTransformer`, Vitest
  `tests/inertia/rfq_my_requests.spec.ts` et `rfqs.spec.ts`. Aide de test
  `tests/utils/quote_documents.ts` (devis PDF reçu sans passer par le mail).
