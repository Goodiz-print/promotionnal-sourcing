# Politique de confidentialité — passages du parcours devis (brouillon)

> ⚠️ **À valider par le client.** Brouillon rédigé pour l'issue #233. Les
> passages entre crochets `[…]` sont à trancher. Ces sections complètent la
> politique existante (`resources/lang/<langue>/privacy.json`), qui ne couvre
> aujourd'hui que les visiteurs du site. Une fois validées, elles s'y ajoutent
> dans les 9 langues, et la date de mise à jour change. **La section
> « Consultations » doit être en ligne avant la mise en production de #239.**

## Données collectées — utilisateurs de la plateforme

_À ajouter à la section « Données collectées »._

- **Demandes de devis** : contenu de la demande (produits, quantités,
  marquage, description, échéance), auteur de la demande et agence au nom de
  laquelle elle est envoyée.
- **Coordonnées professionnelles de l'agence** : dénomination, adresse
  électronique de contact, téléphone, adresse postale, saisies à l'inscription
  ou dans les paramètres de l'organisation.
- **Échanges relayés** : courriers électroniques reçus aux adresses de réponse
  de la plateforme (expéditeur, objet, contenu, en-têtes techniques, pièces
  jointes), messages écrits sur la plateforme, devis PDF.
- **Consultations** : consultation d'une fiche produit ou fournisseur, ajout
  d'un produit à une demande de devis et envoi d'une demande, avec la date et, pour un utilisateur
  connecté, son compte et son organisation.

## Finalités et bases légales

_À ajouter à la section « Finalités et bases légales »._

- **Acheminer les demandes de devis et relayer les échanges entre agences et
  fournisseurs**, y compris la transmission des coordonnées de l'agence aux
  fournisseurs abonnés et l'ajout du nom de l'agence sur le devis d'un
  fournisseur non abonné — base légale : l'exécution du contrat conclu avec
  l'utilisateur (CGU, article 6.1.b du RGPD).
- **Conserver l'historique des demandes et des échanges**, pour le suivi des
  demandes par les deux parties et le traitement des litiges ou signalements —
  base légale : exécution du contrat et intérêt légitime de PROMOTIONAL
  SOURCING (article 6.1.f du RGPD).
- **Mesurer les consultations** pour établir les statistiques de la plateforme
  et les communiquer aux fournisseurs — base légale : intérêt légitime de
  PROMOTIONAL SOURCING et des fournisseurs référencés à connaître l'intérêt
  suscité par leurs produits (article 6.1.f du RGPD) **[à valider, voir point
  n° 3]**.

## Destinataires

_À ajouter à la section « Destinataires et sous-traitants »._

**Fournisseurs destinataires d'une demande de devis.** Le fournisseur reçoit le
contenu de la demande.

- S'il **n'est pas abonné**, il ne reçoit ni le nom, ni le logo, ni les
  coordonnées de l'agence ; les échanges lui parviennent depuis une adresse de
  la plateforme, sans l'adresse de l'expéditeur d'origine. Le contenu rédigé
  par l'agence (texte, signature) n'est pas filtré.
- S'il **est abonné** (formule Business ou Premium), il reçoit le nom de
  l'agence, le nom de l'auteur de la demande, l'adresse électronique de contact
  de l'agence — à défaut, l'adresse électronique de l'auteur de la demande —,
  le téléphone et l'adresse postale de l'agence. Un fournisseur qui s'abonne
  après avoir reçu une demande voit ces informations sur cette demande.

**Agences destinataires d'un devis.** Lorsqu'un fournisseur non abonné répond
par un devis PDF, l'agence reçoit une copie de ce devis sur laquelle la
plateforme a ajouté le nom de l'agence et le numéro de la demande.

**Fournisseurs, pour les consultations.** Tout fournisseur voit le nombre de
consultations de ses produits et de sa fiche. Un fournisseur abonné voit en
outre le **nom des agences** (jamais celui de leurs membres) qui les ont
consultés au cours des 90 derniers jours, le nombre de consultations et la date
de la dernière.

**Équipe de PROMOTIONAL SOURCING.** Les personnes habilitées accèdent aux
statistiques de consultation et, pour la supervision du service, aux courriers
reçus aux adresses de réponse (contenu texte et pièces jointes), afin de
traiter un incident d'acheminement ou de rattacher une réponse mal adressée.

**Sous-traitants** (à ajouter à la liste existante) :

- **Resend** — réception des courriers électroniques adressés aux adresses de
  réponse de la plateforme. **[Localisation des données et éventuels transferts
  hors de l'Union européenne à confirmer par écrit auprès de Resend avant
  publication ; prévoir les garanties appropriées (clauses contractuelles types)
  s'il y a transfert.]**
- **[Prestataire d'envoi des courriers électroniques]** — envoi des demandes,
  relances et courriers relayés.
- **Stripe** — paiement des abonnements des fournisseurs. **[À compléter si
  cette section n'est pas traitée ailleurs.]**

## Durées de conservation

_À ajouter à la section « Durée de conservation »._

- **Consultations** : rattachées au compte et à l'organisation pendant
  **90 jours**, puis détachées de toute identité ; supprimées au bout de
  **24 mois**. _(Valeurs appliquées par la plateforme ; à confirmer.)_
- **Demandes de devis, échanges relayés, pièces jointes et devis** :
  **[durée à fixer]** à compter de la clôture ou de l'échéance de la demande.
  _(Aucune suppression automatique n'est en place aujourd'hui : la durée
  retenue sera appliquée par une purge à développer.)_
- **Courriers écartés** (réponse automatique, adresse inconnue, expéditeur
  non autorisé…) : seuls l'expéditeur, l'adresse visée, l'objet et les en-têtes
  techniques sont conservés, **[durée à fixer]** ; le contenu et les pièces
  jointes ne sont pas conservés.
- **Données techniques d'envoi** : le contenu d'un courrier en attente d'envoi
  est supprimé dès l'envoi réussi, et conservé **30 jours** en cas d'échec
  définitif pour permettre son renvoi.

## Droit d'opposition aux consultations

_Variante à retenir selon l'arbitrage du point n° 3._

**Variante A (décision du 18/11/2026, pas de réglage).** Le suivi des
consultations est nécessaire au fonctionnement des statistiques proposées aux
fournisseurs. Vous pouvez vous y opposer en écrivant à
contact@promotional-sourcing.eu ; votre demande sera examinée au regard de
l'article 21 du RGPD.

**Variante B.** Un réglage de votre compte permet de ne plus être nommé auprès
des fournisseurs ; vos consultations restent comptées, sans identité.
_(Demanderait un développement.)_

## Points à trancher

1. **Durée de conservation des demandes, échanges et devis** — proposition à
   arbitrer : [5] ans après la clôture de la demande (prescription
   commerciale), ou [3] ans après le dernier échange (alignement sur les
   demandes de contact). La même durée s'applique aux courriers écartés, ou une
   plus courte ([12 mois]).
2. **Resend et prestataire d'envoi** : identité, localisation, garanties de
   transfert (voir ADR 0005).
3. **Intérêt légitime pour le suivi nominatif des consultations** : la
   communication du nom de l'agence aux fournisseurs abonnés, sans possibilité
   de refus, est la décision du client du 18/11/2026. À faire valider
   juridiquement (mise en balance des intérêts, information préalable,
   traitement d'une opposition). La variante A ci-dessus reste compatible avec
   l'absence de réglage.
4. **Repli sur l'adresse personnelle de l'auteur** : quand l'agence n'a pas
   d'adresse de contact, c'est l'adresse électronique de la personne qui a
   envoyé la demande qui est transmise aux abonnés. Garder ce repli (et
   l'annoncer, comme ci-dessus) ou exiger une adresse de contact de l'agence.
5. **Durées des consultations** : 90 jours / 24 mois à confirmer.
