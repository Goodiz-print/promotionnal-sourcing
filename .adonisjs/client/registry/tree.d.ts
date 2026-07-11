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
  products: {
    index: typeof routes['products.index']
    show: typeof routes['products.show']
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
    products: {
      index: typeof routes['supplier.products.index']
      create: typeof routes['supplier.products.create']
      store: typeof routes['supplier.products.store']
      edit: typeof routes['supplier.products.edit']
      update: typeof routes['supplier.products.update']
      destroy: typeof routes['supplier.products.destroy']
    }
  }
  admin: {
    categories: {
      index: typeof routes['admin.categories.index']
      create: typeof routes['admin.categories.create']
      store: typeof routes['admin.categories.store']
      edit: typeof routes['admin.categories.edit']
      update: typeof routes['admin.categories.update']
      destroy: typeof routes['admin.categories.destroy']
    }
  }
}
