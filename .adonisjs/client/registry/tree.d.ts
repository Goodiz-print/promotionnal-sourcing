/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  eventStream: typeof routes['event_stream']
  subscribe: typeof routes['subscribe']
  unsubscribe: typeof routes['unsubscribe']
  marketing: {
    sitemap: typeof routes['marketing.sitemap']
    contact: typeof routes['marketing.contact']
    legal: typeof routes['marketing.legal']
    privacy: typeof routes['marketing.privacy']
    thanks: typeof routes['marketing.thanks']
  }
  locale: {
    update: typeof routes['locale.update']
  }
  health: {
    show: typeof routes['health.show']
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
  passkey: {
    login: typeof routes['passkey.login'] & {
      options: typeof routes['passkey.login.options']
    }
  }
  password: {
    forgot: typeof routes['password.forgot']
    email: typeof routes['password.email']
    reset: typeof routes['password.reset']
    update: typeof routes['password.update']
  }
  account: {
    show: typeof routes['account.show']
    update: typeof routes['account.update']
    password: {
      update: typeof routes['account.password.update']
    }
    destroy: typeof routes['account.destroy']
    passkeys: {
      options: typeof routes['account.passkeys.options']
      store: typeof routes['account.passkeys.store']
      update: typeof routes['account.passkeys.update']
      destroy: typeof routes['account.passkeys.destroy']
    }
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
      documents: {
        store: typeof routes['supplier.products.documents.store']
        destroy: typeof routes['supplier.products.documents.destroy']
      }
    }
    documents: {
      store: typeof routes['supplier.documents.store']
      destroy: typeof routes['supplier.documents.destroy']
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
    dashboard: typeof routes['admin.dashboard']
    organizations: {
      index: typeof routes['admin.organizations.index']
      show: typeof routes['admin.organizations.show']
    }
    users: {
      index: typeof routes['admin.users.index']
    }
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
