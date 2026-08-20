import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'event_stream': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'locale.update': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'suppliers.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'suppliers.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'slug': ParamValue} }
    'products.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'products.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'slug': ParamValue} }
    'organization.invitations.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'new_account.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'new_account.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.destroy': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'onboarding.show': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'onboarding.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.invitations.accept': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'organization.settings': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.settings.update': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
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
    'admin.categories.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.categories.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.categories.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.categories.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.categories.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.categories.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
  }
  GET: {
    'event_stream': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'suppliers.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'suppliers.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'slug': ParamValue} }
    'products.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'products.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'slug': ParamValue} }
    'organization.invitations.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'new_account.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'onboarding.show': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.settings': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.members': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.profile': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.products.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.products.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.products.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.categories.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.categories.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.categories.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
  }
  HEAD: {
    'event_stream': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'suppliers.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'suppliers.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'slug': ParamValue} }
    'products.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'products.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'slug': ParamValue} }
    'organization.invitations.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'new_account.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'onboarding.show': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.settings': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.members': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.profile': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.products.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.products.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.products.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.categories.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.categories.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.categories.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
  }
  POST: {
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'locale.update': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.destroy': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'onboarding.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.invitations.accept': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'organization.settings.update': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.invitations.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'organization.invitations.resend': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.products.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.products.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.categories.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
  }
  PATCH: {
    'organization.members.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.profile.update': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'admin.categories.update': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
  }
  DELETE: {
    'organization.members.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'organization.invitations.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'supplier.products.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
    'admin.categories.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}