# ADR 0005 : réception des mails entrants par Resend

- **Statut** : proposé
- **Date** : 2026-11-13
- **Issues liées** : #223 (réception des mails entrants), #224 à #227 et #232 (parcours devis par mail, qui en dépendent)

## Contexte

Le client veut qu'un fournisseur réponde à une demande de devis depuis sa messagerie, en cliquant sur « Répondre », et que la plateforme enregistre cette réponse. L'application n'envoie aujourd'hui que du SMTP sortant : aucun `Reply-To` sur les mails de demande, aucune route de réception.

Clever Cloud (ADR 0003) n'expose pas de port 25 entrant sur une application Docker : l'application ne peut pas être son propre serveur de réception. Il faut un prestataire qui reçoit le mail sur un domaine dont il porte les MX, puis appelle l'application par un webhook HTTPS.

Contraintes :

- le client demande que les mails des fournisseurs (contenu et pièces jointes) soient traités dans l'Union européenne ;
- Resend est déjà le prestataire d'envoi ;
- le webhook doit être authentifié par une signature, le même mail ne doit être traité qu'une fois.

## Décision

**Resend reçoit les mails entrants, sur un sous-domaine dédié `reply.<domaine>`, et notifie l'application par son webhook `email.received`.**

- Le sous-domaine `reply.<domaine>` est ajouté au compte Resend, réception activée, MX posés chez le registrar avec la valeur affichée dans le tableau de bord Resend. Le domaine principal garde ses MX actuels.
- Chaque couple demande / fournisseur a une adresse de réponse `rfq-<jeton>@reply.<domaine>`, posée en `Reply-To` sur les mails de demande et de relance. Le jeton est aléatoire (122 bits), stocké dans `rfq_suppliers.reply_token`.
- Le webhook est signé par Svix (`svix-id`, `svix-timestamp`, `svix-signature`, HMAC-SHA256). L'application vérifie la signature sur le corps brut et refuse un horodatage vieux de plus de cinq minutes.
- Le webhook ne porte que des métadonnées. Le corps, les en-têtes et les pièces jointes sont lus par le worker via l'API Resend, puis copiés dans PostgreSQL et Cellar : la copie de référence est chez nous.
- Le code dépend d'une classe abstraite `InboundMailProvider`, pas de Resend. Changer de prestataire revient à écrire une implémentation.

## Alternatives écartées

| Alternative                             | Raison de l'écart                                                                                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mailgun, région EU                      | Données maintenues en région EU et webhook signé, mais second prestataire, second compte et second domaine à vérifier. Premier repli si le point UE ci-dessous échoue. |
| Brevo                                   | Société française, hébergement UE. Le webhook entrant n'est protégé que par un jeton fixe, sans signature. Second repli.                                               |
| Postmark                                | Hébergé aux États-Unis, webhook sans signature.                                                                                                                        |
| Scaleway Transactional Email            | N'assure pas la réception.                                                                                                                                             |
| Serveur SMTP entrant dans l'application | Pas de port 25 entrant sur Clever Cloud, et un serveur de mail à exploiter.                                                                                            |

## Conséquences

**Positives**

- Un seul prestataire, un seul compte et une seule clé d'API pour l'envoi et la réception.
- Webhook signé, relancé par Resend pendant environ 27 heures en cas d'indisponibilité (8 tentatives).
- Le webhook reste léger (signature, journal, mise en file) : un mail de 20 Mo ne transite pas par la requête HTTP.

**Négatives**

- **L'exigence « traitement dans l'UE » n'est pas démontrée pour la réception.** La documentation de Resend ne dit pas où sont stockés les mails reçus et leurs pièces jointes. Des comparatifs tiers indiquent que les données de compte et les journaux sont aux États-Unis, quelle que soit la région d'envoi.
- Le traitement dépend de la disponibilité de l'API Resend au moment où le worker lit le contenu. Le job est rejoué en cas d'échec.
- La documentation ne garantit pas que tous les en-têtes bruts (`Auto-Submitted`, `Precedence`) figurent dans la réponse de l'API. L'application lit donc aussi le fichier `.eml` d'origine, exposé par Resend, pour filtrer les réponses automatiques.
- Durée de conservation des mails chez Resend et taille maximale d'un mail reçu : non documentées.

## Points à valider avant mise en production

- Obtenir de Resend, par écrit (DPA, liste des sous-traitants), le lieu de stockage des mails reçus et des pièces jointes, et leur durée de conservation. Faire valider la réponse par le client.
- Créer le domaine de réception dans la région européenne de Resend si le tableau de bord le propose.
- Vérifier sur un mail d'absence réel (Outlook, Gmail) que les en-têtes de réponse automatique sont bien lus.
- Mesurer la taille maximale acceptée par Resend à la réception.

## Critères de révision

Passer à Mailgun région EU (ou Brevo) si l'un de ces cas se présente :

- Resend ne peut pas garantir un stockage dans l'UE et le client maintient l'exigence ;
- les en-têtes nécessaires au filtrage des réponses automatiques ne sont pas accessibles ;
- des mails sont perdus ou livrés hors délai de façon répétée.
