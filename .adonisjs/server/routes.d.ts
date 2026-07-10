import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'event_stream': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'locale.update': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'new_account.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'new_account.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.destroy': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
  }
  GET: {
    'event_stream': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'new_account.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
  }
  HEAD: {
    'event_stream': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'new_account.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.create': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
  }
  POST: {
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'locale.update': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.store': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
    'session.destroy': { paramsTuple: [ParamValue]; params: {'locale': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}