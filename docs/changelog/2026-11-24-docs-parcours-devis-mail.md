# Documentation du parcours devis par mail et brouillons légaux

> Date : 2026-11-24

Issue #233, dernière du suivi #234. Documentation seule : aucun changement de
code, de route ni de migration.

- **`docs/rfq.md`** : nouvelle section « Parcours devis par mail (#234) », qui
  résume le parcours livré étape par étape avec ses issues (#212, #214 à #232,
  #237 à #240) et renvoie aux sections détaillées. Corrections : statut
  `expired` et colonnes `reply_token`, `agency_reply_token`, `reminded_at`,
  `expired_from`, `late_reply_at` de `rfq_suppliers` ; abilities du parcours
  (fil, devis PDF, consultations) ; un `member` publie et envoie (#216) ; un
  produit d'une fiche non rattachée n'est plus demandable (#240) ; la demande
  « en un clic » (#55) part par le même envoi que le panier ; idempotence des
  mails et suppression d'un brouillon marquées traitées.
- **`docs/quotes.md`** : #218 abandonnée (le destinataire est toujours une
  organisation) ; réponse tardive après l'échéance (#232) ; champs `late` et
  `inboundMailId` nullable de `SupplierReplyRecorded`.
- **`docs/quote-cart.md`** : « Mes demandes » regroupe par lot (#228) ; les
  `specs` figurent dans le mail depuis #219 ; renvoi vers le parcours.
- **`docs/mail.md`** : relance sur l'absence de réponse (#232) ; langue de
  `rfq-reminder`, `agency-message-relayed`, `supplier-reply-received` et
  `quote-email-verification` ; anonymat des mails ; nouvelle section
  « Conservation des mails relayés » (aucune purge des mails entrants, des
  messages ni de `mail_deliveries` à ce jour ; charge des jobs gardée 30 jours
  en échec).
- **`docs/abonnements.md`** : tableau « Ce que l'abonnement change dans le
  parcours devis » (anonymat, coordonnées, relais, bandeau PDF, consultations,
  équipe commerciale).
- **`docs/comptes-fournisseurs-agences.md`** : formule dans
  `organization_subscriptions` ; conservation des consultations (pseudonymisation
  à 90 jours, suppression à 24 mois) ; point ouvert « événements d'usage »
  traité.
- **`docs/product-context.md`** : sections « Parcours devis » et « Rôle de
  l'abonnement », formules et prix.
- **Brouillons légaux**, à valider par le client, dans `docs/legal/` : passages
  des CGU (`cgu-parcours-devis.md`) et de la politique de confidentialité
  (`politique-confidentialite-parcours-devis.md`) — relais et conservation des
  échanges, anonymat pour les non-abonnés, coordonnées transmises aux abonnés,
  bandeau sur le devis PDF, suivi des consultations. Chacun liste ses points à
  trancher (durée de conservation des mails, Resend, intérêt légitime).
  **#239 ne part pas en production avant la mise en ligne de la mention des
  consultations.**
