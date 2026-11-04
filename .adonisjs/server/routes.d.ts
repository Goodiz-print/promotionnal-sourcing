import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'event_stream': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'marketing.sitemap': { paramsTuple?: []; params?: {} }
    'locale.update': { paramsTuple?: []; params?: {} }
    'health.show': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'marketing.contact': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'marketing.contact.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'marketing.legal': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'marketing.privacy': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'marketing.thanks': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'suppliers.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'suppliers.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'slug': ParamValue} }
    'products.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'products.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'slug': ParamValue} }
    'organization.invitations.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'email.verify': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'new_account.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'new_account.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'agency_signup.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'agency_signup.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'passkey.login.options': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'passkey.login': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'password.forgot': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'password.email': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'password.reset': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'password.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'session.destroy': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'email.notice': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'email.verification.resend': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'account.show': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'account.update': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'account.password.update': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'account.destroy': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'account.passkeys.options': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'account.passkeys.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'account.passkeys.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'account.passkeys.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'products.image_search': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'onboarding.show': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'onboarding.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.invitations.accept': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'dashboard.show': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.settings': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.settings.update': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.switch': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'organization.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.leave': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.archive': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.members': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.members.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'organization.members.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'organization.invitations.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.invitations.resend': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'organization.invitations.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.profile': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.profile.update': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.products.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.products.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.products.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.products.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.products.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.products.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.documents.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.documents.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.products.documents.store': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.products.documents.destroy': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue,'documentId': ParamValue} }
    'rfqs.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'rfqs.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'rfqs.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'rfqs.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'rfqs.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'rfqs.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'rfqs.items.from_product': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'rfqs.suppliers.store': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'rfqs.suppliers.destroy': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue,'supplierId': ParamValue} }
    'rfqs.publish': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'rfqs.send': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'rfqs.close': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'rfqs.deadline.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.rfqs.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.rfqs.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.rfqs.decline': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'quotes.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'quotes.accept': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'quotes.reject': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.quotes.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.quotes.create': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'rfqId': ParamValue} }
    'supplier.quotes.store': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'rfqId': ParamValue} }
    'supplier.quotes.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.quotes.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.quotes.submit': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.quotes.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'orders.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'orders.deliver': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'orders.cancel': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.orders.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.orders.confirm': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.orders.produce': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.orders.ship': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.orders.cancel': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'notifications.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'notifications.read': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'notifications.readAll': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.dashboard': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.organizations.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.organizations.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.organizations.archive': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.organizations.restore': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.organizations.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.organizations.change_type': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.organizations.member_role': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue,'membershipId': ParamValue} }
    'admin.organizations.remove_member': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue,'membershipId': ParamValue} }
    'admin.organizations.revoke_invitation': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue,'invitationId': ParamValue} }
    'admin.organizations.resend_invitation': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue,'invitationId': ParamValue} }
    'admin.users.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.users.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.users.platform_role.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.users.suspend': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.users.reactivate': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.users.resend_verification': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.users.password_reset': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.users.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.audit.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.products.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.products.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.products.hide': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.products.unhide': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.products.unpublish': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.products.publish': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.products.archive': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.products.restore': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.products.reindex': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.moderation.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.moderation.show': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'locale': ParamValue,'type': ParamValue,'id': ParamValue} }
    'admin.moderation.decide': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'locale': ParamValue,'type': ParamValue,'id': ParamValue} }
    'admin.agency_reviews.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.agency_reviews.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.agency_reviews.decide': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.rfqs.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.rfqs.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.rfqs.close': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.rfqs.expire': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.rfqs.remind': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.quotes.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.quotes.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.orders.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.demand.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.demand.export': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.categories.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.categories.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.categories.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.categories.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.categories.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.categories.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.attributes.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.attributes.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.attributes.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.attributes.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.attributes.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.attributes.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.attribute_values.store': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.attribute_values.update': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue,'valueId': ParamValue} }
    'admin.attribute_values.destroy': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue,'valueId': ParamValue} }
  }
  GET: {
    'event_stream': { paramsTuple?: []; params?: {} }
    'marketing.sitemap': { paramsTuple?: []; params?: {} }
    'health.show': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'marketing.contact': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'marketing.legal': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'marketing.privacy': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'marketing.thanks': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'suppliers.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'suppliers.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'slug': ParamValue} }
    'products.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'products.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'slug': ParamValue} }
    'organization.invitations.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'email.verify': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'new_account.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'agency_signup.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'passkey.login.options': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'password.forgot': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'password.reset': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'email.notice': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'account.show': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'account.passkeys.options': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'onboarding.show': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'dashboard.show': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.settings': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.members': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.profile': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.products.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.products.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.products.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'rfqs.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'rfqs.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'rfqs.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.rfqs.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.rfqs.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'quotes.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.quotes.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.quotes.create': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'rfqId': ParamValue} }
    'supplier.quotes.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'orders.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.orders.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'notifications.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.dashboard': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.organizations.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.organizations.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.users.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.users.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.audit.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.products.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.products.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.moderation.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.moderation.show': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'locale': ParamValue,'type': ParamValue,'id': ParamValue} }
    'admin.agency_reviews.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.agency_reviews.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.rfqs.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.rfqs.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.quotes.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.quotes.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.orders.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.demand.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.demand.export': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.categories.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.categories.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.categories.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.attributes.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.attributes.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.attributes.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
  }
  HEAD: {
    'event_stream': { paramsTuple?: []; params?: {} }
    'marketing.sitemap': { paramsTuple?: []; params?: {} }
    'health.show': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'marketing.contact': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'marketing.legal': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'marketing.privacy': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'marketing.thanks': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'suppliers.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'suppliers.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'slug': ParamValue} }
    'products.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'products.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'slug': ParamValue} }
    'organization.invitations.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'email.verify': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'new_account.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'agency_signup.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'passkey.login.options': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'password.forgot': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'password.reset': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'email.notice': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'account.show': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'account.passkeys.options': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'onboarding.show': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'dashboard.show': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.settings': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.members': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.profile': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.products.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.products.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.products.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'rfqs.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'rfqs.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'rfqs.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.rfqs.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.rfqs.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'quotes.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.quotes.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.quotes.create': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'rfqId': ParamValue} }
    'supplier.quotes.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'orders.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.orders.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'notifications.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.dashboard': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.organizations.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.organizations.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.users.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.users.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.audit.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.products.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.products.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.moderation.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.moderation.show': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'locale': ParamValue,'type': ParamValue,'id': ParamValue} }
    'admin.agency_reviews.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.agency_reviews.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.rfqs.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.rfqs.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.quotes.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.quotes.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.orders.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.demand.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.demand.export': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.categories.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.categories.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.categories.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.attributes.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.attributes.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.attributes.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
  }
  POST: {
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'locale.update': { paramsTuple?: []; params?: {} }
    'marketing.contact.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'new_account.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'agency_signup.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'passkey.login': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'password.email': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'password.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'session.destroy': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'email.verification.resend': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'account.passkeys.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'products.image_search': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'onboarding.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.invitations.accept': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'organization.settings.update': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.switch': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'organization.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.archive': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.invitations.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.invitations.resend': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.products.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.products.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.documents.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.products.documents.store': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'rfqs.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'rfqs.items.from_product': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'rfqs.suppliers.store': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'rfqs.publish': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'rfqs.send': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'rfqs.close': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.rfqs.decline': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.quotes.store': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'rfqId': ParamValue} }
    'supplier.quotes.submit': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'notifications.readAll': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.organizations.archive': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.organizations.restore': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.organizations.resend_invitation': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue,'invitationId': ParamValue} }
    'admin.users.suspend': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.users.reactivate': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.users.resend_verification': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.users.password_reset': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.products.hide': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.products.unhide': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.products.unpublish': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.products.publish': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.products.archive': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.products.restore': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.products.reindex': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.moderation.decide': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'locale': ParamValue,'type': ParamValue,'id': ParamValue} }
    'admin.agency_reviews.decide': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.rfqs.close': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.rfqs.expire': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.rfqs.remind': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.categories.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.attributes.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.attribute_values.store': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
  }
  PATCH: {
    'account.update': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'account.password.update': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'account.passkeys.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'organization.members.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.profile.update': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'rfqs.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'rfqs.deadline.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'quotes.accept': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'quotes.reject': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.quotes.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'orders.deliver': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'orders.cancel': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.orders.confirm': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.orders.produce': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.orders.ship': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.orders.cancel': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'notifications.read': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.organizations.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.organizations.change_type': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.organizations.member_role': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue,'membershipId': ParamValue} }
    'admin.users.platform_role.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.categories.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.attributes.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.attribute_values.update': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue,'valueId': ParamValue} }
  }
  DELETE: {
    'account.destroy': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'account.passkeys.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'organization.leave': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.members.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'organization.invitations.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.products.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.documents.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.products.documents.destroy': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue,'documentId': ParamValue} }
    'rfqs.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'rfqs.suppliers.destroy': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue,'supplierId': ParamValue} }
    'supplier.quotes.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.organizations.remove_member': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue,'membershipId': ParamValue} }
    'admin.organizations.revoke_invitation': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue,'invitationId': ParamValue} }
    'admin.users.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.categories.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.attributes.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.attribute_values.destroy': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue,'valueId': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}