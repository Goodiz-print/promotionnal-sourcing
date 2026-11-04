/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  eventStream: typeof routes['event_stream']
  subscribe: typeof routes['subscribe']
  unsubscribe: typeof routes['unsubscribe']
  marketing: {
    sitemap: typeof routes['marketing.sitemap']
    contact: typeof routes['marketing.contact'] & {
      store: typeof routes['marketing.contact.store']
    }
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
    imageSearch: typeof routes['products.image_search']
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
  agencySignup: {
    create: typeof routes['agency_signup.create']
    store: typeof routes['agency_signup.store']
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
  dashboard: {
    show: typeof routes['dashboard.show']
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
    quotes: {
      index: typeof routes['supplier.quotes.index']
      create: typeof routes['supplier.quotes.create']
      store: typeof routes['supplier.quotes.store']
      show: typeof routes['supplier.quotes.show']
      update: typeof routes['supplier.quotes.update']
      submit: typeof routes['supplier.quotes.submit']
      destroy: typeof routes['supplier.quotes.destroy']
    }
    orders: {
      index: typeof routes['supplier.orders.index']
      show: typeof routes['supplier.orders.show']
      confirm: typeof routes['supplier.orders.confirm']
      produce: typeof routes['supplier.orders.produce']
      ship: typeof routes['supplier.orders.ship']
      cancel: typeof routes['supplier.orders.cancel']
    }
  }
  rfqs: {
    index: typeof routes['rfqs.index']
    create: typeof routes['rfqs.create']
    store: typeof routes['rfqs.store']
    show: typeof routes['rfqs.show']
    update: typeof routes['rfqs.update']
    destroy: typeof routes['rfqs.destroy']
    items: {
      fromProduct: typeof routes['rfqs.items.from_product']
    }
    suppliers: {
      store: typeof routes['rfqs.suppliers.store']
      destroy: typeof routes['rfqs.suppliers.destroy']
    }
    publish: typeof routes['rfqs.publish']
    send: typeof routes['rfqs.send']
    close: typeof routes['rfqs.close']
    deadline: {
      update: typeof routes['rfqs.deadline.update']
    }
  }
  quotes: {
    show: typeof routes['quotes.show']
    accept: typeof routes['quotes.accept']
    reject: typeof routes['quotes.reject']
  }
  orders: {
    index: typeof routes['orders.index']
    show: typeof routes['orders.show']
    deliver: typeof routes['orders.deliver']
    cancel: typeof routes['orders.cancel']
  }
  notifications: {
    index: typeof routes['notifications.index']
    read: typeof routes['notifications.read']
    readAll: typeof routes['notifications.readAll']
  }
  admin: {
    dashboard: typeof routes['admin.dashboard']
    organizations: {
      index: typeof routes['admin.organizations.index']
      show: typeof routes['admin.organizations.show']
      archive: typeof routes['admin.organizations.archive']
      restore: typeof routes['admin.organizations.restore']
      update: typeof routes['admin.organizations.update']
      changeType: typeof routes['admin.organizations.change_type']
      memberRole: typeof routes['admin.organizations.member_role']
      removeMember: typeof routes['admin.organizations.remove_member']
      revokeInvitation: typeof routes['admin.organizations.revoke_invitation']
      resendInvitation: typeof routes['admin.organizations.resend_invitation']
    }
    users: {
      index: typeof routes['admin.users.index']
      show: typeof routes['admin.users.show']
      platformRole: {
        update: typeof routes['admin.users.platform_role.update']
      }
      suspend: typeof routes['admin.users.suspend']
      reactivate: typeof routes['admin.users.reactivate']
      resendVerification: typeof routes['admin.users.resend_verification']
      passwordReset: typeof routes['admin.users.password_reset']
      destroy: typeof routes['admin.users.destroy']
    }
    audit: {
      index: typeof routes['admin.audit.index']
    }
    products: {
      index: typeof routes['admin.products.index']
      show: typeof routes['admin.products.show']
      hide: typeof routes['admin.products.hide']
      unhide: typeof routes['admin.products.unhide']
      unpublish: typeof routes['admin.products.unpublish']
      publish: typeof routes['admin.products.publish']
      archive: typeof routes['admin.products.archive']
      restore: typeof routes['admin.products.restore']
      reindex: typeof routes['admin.products.reindex']
    }
    moderation: {
      index: typeof routes['admin.moderation.index']
      show: typeof routes['admin.moderation.show']
      decide: typeof routes['admin.moderation.decide']
    }
    agencyReviews: {
      index: typeof routes['admin.agency_reviews.index']
      show: typeof routes['admin.agency_reviews.show']
      decide: typeof routes['admin.agency_reviews.decide']
    }
    rfqs: {
      index: typeof routes['admin.rfqs.index']
      show: typeof routes['admin.rfqs.show']
      close: typeof routes['admin.rfqs.close']
      expire: typeof routes['admin.rfqs.expire']
      remind: typeof routes['admin.rfqs.remind']
    }
    quotes: {
      index: typeof routes['admin.quotes.index']
      show: typeof routes['admin.quotes.show']
    }
    orders: {
      index: typeof routes['admin.orders.index']
      show: typeof routes['admin.orders.show']
    }
    demand: {
      index: typeof routes['admin.demand.index']
      export: typeof routes['admin.demand.export']
    }
    categories: {
      index: typeof routes['admin.categories.index']
      create: typeof routes['admin.categories.create']
      store: typeof routes['admin.categories.store']
      edit: typeof routes['admin.categories.edit']
      update: typeof routes['admin.categories.update']
      destroy: typeof routes['admin.categories.destroy']
      attributes: {
        store: typeof routes['admin.categories.attributes.store']
        update: typeof routes['admin.categories.attributes.update']
        destroy: typeof routes['admin.categories.attributes.destroy']
        ranges: {
          update: typeof routes['admin.categories.attributes.ranges.update']
        }
      }
    }
    attributes: {
      index: typeof routes['admin.attributes.index']
      create: typeof routes['admin.attributes.create']
      store: typeof routes['admin.attributes.store']
      edit: typeof routes['admin.attributes.edit']
      update: typeof routes['admin.attributes.update']
      destroy: typeof routes['admin.attributes.destroy']
    }
    attributeValues: {
      store: typeof routes['admin.attribute_values.store']
      update: typeof routes['admin.attribute_values.update']
      destroy: typeof routes['admin.attribute_values.destroy']
    }
    certifications: {
      index: typeof routes['admin.certifications.index']
      create: typeof routes['admin.certifications.create']
      store: typeof routes['admin.certifications.store']
      edit: typeof routes['admin.certifications.edit']
      update: typeof routes['admin.certifications.update']
      destroy: typeof routes['admin.certifications.destroy']
    }
    markingTechniques: {
      index: typeof routes['admin.marking_techniques.index']
      create: typeof routes['admin.marking_techniques.create']
      store: typeof routes['admin.marking_techniques.store']
      edit: typeof routes['admin.marking_techniques.edit']
      update: typeof routes['admin.marking_techniques.update']
      destroy: typeof routes['admin.marking_techniques.destroy']
    }
  }
}
