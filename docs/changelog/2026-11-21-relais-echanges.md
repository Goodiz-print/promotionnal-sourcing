# Relais des échanges agence ↔ fournisseur

> Date : 2026-11-21

Issue #226 (suivi #234). Le fournisseur gratuit n'échange avec l'agence que par
les mails de la plateforme, et tout reste enregistré dans le fil de la demande,
visible des deux côtés.

- **Une adresse relais par côté** : `rfq-<reply_token>@…` pour le fournisseur,
  `agency-<agency_reply_token>@…` pour l'agence. `relayTargetFrom` rend le côté
  qui écrit et le jeton ; le couple est cherché par la colonne de ce côté
  seulement (`RELAY_TOKEN_FIELDS`). `InboundMailReceived` porte désormais `side`,
  `InboundAddressService` gagne `relayAddressFor`, `targetFrom` et `sideOf`.
- **Mail de l'agence** : `AgencyReplyService` l'enregistre comme message de
  l'agence (pièces jointes comprises, jamais pris pour un devis), puis il est
  relayé au fournisseur. Un mail envoyé à `agency-…` n'est plus écarté en
  `unknown_address`.
- **Relais** (`ConversationMessageRecorded` → `MessageRelayService`) : un message
  de l'agence part aux adresses de réception du fournisseur, nouveau mail
  `agency-message-relayed` (`AgencyMessageRelayedNotification`, HTML et texte,
  9 langues) ; un message du fournisseur écrit dans l'application part à
  l'agence comme sa réponse par mail (`supplier-reply-received`, #225), qui
  invite maintenant à répondre.
- **Anonymat** : expéditeur la plateforme, `Reply-To` l'adresse relais de
  l'autre côté, agence nommée seulement pour un fournisseur abonné. Seuls les
  en-têtes de priorité du mail d'origine sont repris (`relayableHeaders`, liste
  blanche) ; `From`, `Reply-To`, `Received`, `X-Originating-IP`, `Message-ID`…
  sont écartés. Le corps n'est pas filtré (décision du client).
- **Écrans** : composant `inertia/components/messaging/conversation_thread.vue`
  (messages, « par mail », expéditeur du mail, pièces jointes, signalement,
  écriture) sur le détail d'une demande côté agence (un fil par destinataire
  notifié, prop `threads`) et côté fournisseur (prop `thread`).
- **Routes** : `POST /:locale/rfqs/:id/suppliers/:supplierId/messages`
  (`rfqs.messages.store`) et `POST /:locale/supplier/rfqs/:id/messages`
  (`supplier.rfqs.messages.store`), validator `rfqMessageValidator`, redirection
  et message flash. Abilities `canMessageRfqSupplier` (tout membre de l'agence,
  destinataire notifié, fil ouvert) et `canMessageRfqBuyer` (rôles qui
  répondent aux demandes, fil ouvert), adhésion lue une fois par requête.
- **Données** : `messages.sender_side` (`agency` | `supplier`, migration
  `1794000000037`, lignes existantes remplies). `ConversationService#post`
  accepte `{ body, side }` ; un côté qui n'est pas celui de l'auteur est refusé.
- **Historique cité retiré** : `stripQuotedReply` coupe une réponse par mail à
  la première marque de citation (`>`, « Le … a écrit : », « -----Original
  Message----- », en-tête `De :` / `Envoyé :`), des deux côtés.
- **Expéditeur de l'agence vérifié** : un mail à `agency-…` qui ne vient pas
  d'un membre de l'agence est écarté (nouveau motif `unknown_sender`) ; un admin
  peut le rattacher à la main.
- **Fil clos** : passé `INBOUND_MAIL_GRACE_DAYS` après la clôture ou
  l'expiration de la demande (`isRelayWindowClosed`, même règle que l'adresse
  relais), on n'écrit plus depuis l'écran ; `RfqThreadType.closed`.
- **Derniers messages** : 100 derniers messages par fil
  (`THREAD_MESSAGES_LIMIT`), `RfqThreadType.hasOlder` signale les plus anciens.
- **Signalement** : le signalement existant (`messages/:id/report`) fonctionne
  sur ces messages, depuis le fil.
- **Tests** : `tests/functional/rfq_message_relay.spec.ts`,
  `tests/unit/conversation_helpers.spec.ts`, `tests/unit/inbound_mail_helpers.spec.ts`,
  `tests/unit/mail_templates.spec.ts`, `tests/inertia/conversation_thread.spec.ts`.
