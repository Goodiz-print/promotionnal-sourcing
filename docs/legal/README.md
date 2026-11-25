# Textes légaux — brouillons

> ⚠️ **Brouillons à valider par le client** (et, si besoin, par son avocat).
> Rien de ce dossier n'est publié sur le site. **#239 (page « Consultations »)
> ne part pas en production avant que la mention des consultations soit en
> ligne** (décision client du 18/11/2026, issue #233).

Passages rédigés pour le parcours devis par mail (#234). Les faits techniques
(durées, destinataires, données) sont lus dans le code au 24/11/2026 ; chaque
texte termine par ses points à trancher.

| Fichier                                                                                      | Contenu                                                                                                                                             |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`cgu-parcours-devis.md`](cgu-parcours-devis.md)                                             | Passages des CGU : relais des échanges, anonymat des agences, coordonnées transmises aux abonnés, bandeau sur le devis PDF, suivi des consultations |
| [`politique-confidentialite-parcours-devis.md`](politique-confidentialite-parcours-devis.md) | Passages de la politique de confidentialité : données traitées, destinataires, durées de conservation                                               |

## Où ces textes iront

- **Politique de confidentialité** : la page existe (`/:locale/privacy`, textes
  dans `resources/lang/<langue>/privacy.json`, 9 langues). Elle ne couvre
  aujourd'hui que les visiteurs du site (formulaire de contact, journaux,
  recherches). Les passages validés s'y ajoutent comme nouvelles sections, puis
  se traduisent dans les 9 langues ; la date `updatedAt` change.
- **CGU** : aucune page n'existe encore. L'inscription agence fait pourtant
  accepter les « conditions générales d'utilisation » (consentement journalisé
  dans `legal_consents`, version `CURRENT_LEGAL_VERSION` = `2026-10-19`,
  `shared/types/legal.ts`). Publier les CGU, et passer la version à la date de
  publication, fait apparaître les consentements antérieurs comme « à
  renouveler » dans le back-office.

## Points communs à trancher

1. **Durée de conservation des mails relayés et des devis** : aucune purge
   n'existe aujourd'hui (voir `docs/mail.md`, « Conservation des mails
   relayés »). Une durée doit être fixée, puis une purge planifiée écrite.
2. **Lieu de stockage chez Resend** (réception des mails) : non démontré dans
   l'Union européenne (ADR 0005). À obtenir par écrit avant de rédiger la
   ligne « sous-traitants » définitive.
3. **Prestataire d'envoi des mails** (SMTP de production) : à nommer dans la
   liste des sous-traitants.
4. **Durées des consultations** : 90 jours (identité visible, puis
   pseudonymisation) et 24 mois (suppression) sont les valeurs du code ; à
   confirmer par le client.
