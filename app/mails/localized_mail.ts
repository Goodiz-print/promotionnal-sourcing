import { BaseMail } from '@adonisjs/mail'
import i18nManager from '@adonisjs/i18n/services/main'
import env from '#start/env'
import type { Locale } from '#shared/types/i18n'

/**
 * Mail rendu dans la langue de son destinataire.
 *
 * Le worker n'a pas de requête HTTP : la langue est portée par la charge du job
 * (`SendMailPayload.locale`) et passée au constructeur. Sujet et gabarit lisent
 * leurs textes dans `resources/lang/<locale>/emails.json` (clés `emails.*`) :
 *
 * - le **sujet** via `this.t(clé, données)` ;
 * - le **gabarit** Edge via `{{ t('emails.…') }}` — le helper `t` du plugin i18n
 *   lit l'état de vue `i18n`, que `htmlViewIn()` renseigne avec la bonne langue
 *   (sans lui, `t` retomberait sur la langue par défaut).
 *
 * Les textes ne contiennent jamais de balise : les valeurs dynamiques (noms
 * saisis par des utilisateurs) restent échappées par Edge.
 */
export default abstract class LocalizedMail extends BaseMail {
  protected readonly i18n

  constructor(protected readonly locale: Locale) {
    super()
    this.i18n = i18nManager.locale(locale)
  }

  /** Nom de l'application, injecté dans les textes (`{brandName}`). */
  protected get brandName(): string {
    return env.get('APP_NAME', 'Promotionnal Sourcing')
  }

  /** Traduction d'un texte de mail, `brandName` toujours disponible. */
  protected t(key: string, data: Record<string, unknown> = {}): string {
    return this.i18n.t(key, { brandName: this.brandName, ...data })
  }

  /**
   * Gabarit HTML rendu dans la langue du destinataire. `brandName` est aussi
   * posé dans l'état de vue : les gabarits le passent à `t()`.
   */
  protected htmlViewIn(template: string, state: Record<string, unknown> = {}) {
    return this.message.htmlView(template, {
      ...state,
      i18n: this.i18n,
      locale: this.locale,
      brandName: this.brandName,
    })
  }
}
