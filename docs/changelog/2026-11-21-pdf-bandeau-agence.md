# Nom de l'agence apposé sur le devis PDF d'un fournisseur non abonné

> Date : 2026-11-21

Issue #238 (suivi #234). Un fournisseur non abonné ne connaît pas l'agence
(#220) : le devis PDF qu'il renvoie par mail n'en porte pas le nom. À
l'enregistrement de sa réponse, la plateforme produit désormais une **version
destinataire** de chaque devis PDF, celle que recevra l'agence (#225).

- **Bandeau** « Devis établi pour : <agence> — demande n° <id> » en tête de la
  première page : la page est agrandie vers le haut, rien n'est masqué ni
  déplacé. **Page de garde** en repli si la première page est pivotée ou déjà à
  la taille maximale. `PdfService#stampRecipient`, nouvelle dépendance
  `pdf-lib` ; options typées `RecipientStampOptions` (`shared/types/pdf.ts`).
- **Repli** : PDF chiffré, signé ou illisible, ou nom d'agence hors de
  l'alphabet latin de la police standard → transmis tel quel, warning loggé
  avec la demande et la pièce jointe, jamais d'erreur.
- **Abonnés** : leur devis n'est pas modifié (abonnement lu au moment de la
  réponse, `SubscriptionService#isSubscribed`).
- **Migration** `1794000000034` : `quote_documents.recipient_storage_object_id`
  (FK `storage_objects`, nullable) et `stamped_at`. La colonne rejoint
  `STORAGE_REFERENCES` et `OWNER_SELECTS` (la copie compte pour l'agence).
- **Zéro orphelin** : copie stockée avant la transaction, référencée dedans,
  libérée par `StorageService.discard` si elle échoue.
- **Accès** : le fil du fournisseur garde le PDF d'origine ; l'agence lit
  `QuoteDocument#recipientFile` (copie, sinon original).
- **Tests** : `tests/unit/pdf_service.spec.ts`,
  `tests/functional/supplier_reply_recipient_version.spec.ts`.
