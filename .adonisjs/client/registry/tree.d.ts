/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  eventStream: typeof routes['event_stream']
  subscribe: typeof routes['subscribe']
  unsubscribe: typeof routes['unsubscribe']
  locale: {
    update: typeof routes['locale.update']
  }
  home: typeof routes['home']
  suppliers: {
    index: typeof routes['suppliers.index']
    show: typeof routes['suppliers.show']
  }
  newAccount: {
    create: typeof routes['new_account.create']
    store: typeof routes['new_account.store']
  }
  session: {
    create: typeof routes['session.create']
    store: typeof routes['session.store']
    destroy: typeof routes['session.destroy']
  }
  onboarding: {
    show: typeof routes['onboarding.show']
    store: typeof routes['onboarding.store']
  }
  supplier: {
    profile: typeof routes['supplier.profile'] & {
      update: typeof routes['supplier.profile.update']
    }
  }
}
