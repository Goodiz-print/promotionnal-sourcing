# Revue des inscriptions agence

> Date : 2026-11-03

Issue #162 (epic #157). Nouvel onglet « Agences » du back-office (`GET /admin/agency-reviews`, droit `moderation.manage` : `admin` et `moderator`). Une agence est « à revoir » tant que `organizations.review_reasons` n'est pas vide (inscription non validée automatiquement par `AgencySignupService`) et qu'elle n'est pas archivée.

- **File** : motifs de revue, résultat VIES (`vat_verified_at`), vérification du domaine (`domain_verified_at`), ancienneté, statut. Filtre « À revoir » (défaut), « Validées », « Rejetées ».
- **Fiche** (`GET /admin/agency-reviews/:id`) : identité de l'agence, contrôles, propriétaires du compte, historique des décisions.
- **Décision** (`POST /admin/agency-reviews/:id/decision`) :
  - `approved` vide `review_reasons` (l'agence sort de la file) ;
  - `rejected` archive l'organisation (rien n'est supprimé, la restauration se fait en base) ; motif obligatoire ;
  - `info_requested` garde l'agence dans la file ; le motif est le message envoyé à l'agence, obligatoire.
- **Traçabilité** : table `agency_review_decisions` en ajout seul (décision, motif, motifs de revue au moment de la décision, auteur) ; entrée `agency_review.approved|rejected|info_requested` dans le journal d'audit, écrite dans la même transaction que la décision.
- **Mail** : un mail par propriétaire, dans sa langue, par la queue (`SendMailJob`, kind `agency-review-decision`, clé d'idempotence par décision et destinataire).
- **Tableau de bord** : compteur « Agences à revoir » (`pendingAgencyReviews`), avec lien vers la file.
- **Code** : `AdminAgencyReviewService`, `AgencyReviewNotificationService`, `Admin/AgencyReviewController`, `AgencyReviewDecisionNotification`, types dans `shared/types/agency_review.ts`, traductions `admin.agencyReviews.*` et `emails.agencyReview.*` dans les 9 langues.
- **Limite** : un rejet archive l'organisation mais l'archivage est fait après la validation de la transaction de décision (il réutilise `OrganizationService.archive`, qui ouvre la sienne).
- Tests : `tests/functional/admin_agency_reviews.spec.ts`, `tests/unit/mail_templates.spec.ts`.
