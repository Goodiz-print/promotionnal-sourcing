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
    'new_account.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'new_account.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.destroy': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'onboarding.show': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'onboarding.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.profile': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.profile.update': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
  }
  GET: {
    'event_stream': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'suppliers.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'suppliers.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'slug': ParamValue} }
    'new_account.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'onboarding.show': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.profile': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
  }
  HEAD: {
    'event_stream': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'suppliers.index': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'suppliers.show': { paramsTuple: [ParamValue,ParamValue]; params: {'locale': ParamValue,'slug': ParamValue} }
    'new_account.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'onboarding.show': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'supplier.profile': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
  }
  POST: {
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'locale.update': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.destroy': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'onboarding.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
  }
  PATCH: {
    'supplier.profile.update': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}