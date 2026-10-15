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
  organization: {
    invitations: {
      show: typeof routes['organization.invitations.show']
      accept: typeof routes['organization.invitations.accept']
      store: typeof routes['organization.invitations.store']
      resend: typeof routes['organization.invitations.resend']
      destroy: typeof routes['organization.invitations.destroy']
    }
    settings: typeof routes['organization.settings'] & {
      update: typeof routes['organization.settings.update']
    }
    switch: typeof routes['organization.switch']
    create: typeof routes['organization.create']
    store: typeof routes['organization.store']
    leave: typeof routes['organization.leave']
    archive: typeof routes['organization.archive']
    members: typeof routes['organization.members'] & {
      update: typeof routes['organization.members.update']
      destroy: typeof routes['organization.members.destroy']
    }
  }
  email: {
    verify: typeof routes['email.verify']
    notice: typeof routes['email.notice']
    verification: {
      resend: typeof routes['email.verification.resend']
    }
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
  password: {
    forgot: typeof routes['password.forgot']
    email: typeof routes['password.email']
    reset: typeof routes['password.reset']
    update: typeof routes['password.update']
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
    rfqs: {
      index: typeof routes['supplier.rfqs.index']
      show: typeof routes['supplier.rfqs.show']
      decline: typeof routes['supplier.rfqs.decline']
    }
  }
  rfqs: {
    index: typeof routes['rfqs.index']
    create: typeof routes['rfqs.create']
    store: typeof routes['rfqs.store']
    show: typeof routes['rfqs.show']
    update: typeof routes['rfqs.update']
    suppliers: {
      store: typeof routes['rfqs.suppliers.store']
      destroy: typeof routes['rfqs.suppliers.destroy']
    }
    publish: typeof routes['rfqs.publish']
    send: typeof routes['rfqs.send']
    close: typeof routes['rfqs.close']
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
