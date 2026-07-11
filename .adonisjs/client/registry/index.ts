/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'event_stream': {
    methods: ["GET","HEAD"],
    pattern: '/__transmit/events',
    tokens: [{"old":"/__transmit/events","type":0,"val":"__transmit","end":""},{"old":"/__transmit/events","type":0,"val":"events","end":""}],
    types: placeholder as Registry['event_stream']['types'],
  },
  'subscribe': {
    methods: ["POST"],
    pattern: '/__transmit/subscribe',
    tokens: [{"old":"/__transmit/subscribe","type":0,"val":"__transmit","end":""},{"old":"/__transmit/subscribe","type":0,"val":"subscribe","end":""}],
    types: placeholder as Registry['subscribe']['types'],
  },
  'unsubscribe': {
    methods: ["POST"],
    pattern: '/__transmit/unsubscribe',
    tokens: [{"old":"/__transmit/unsubscribe","type":0,"val":"__transmit","end":""},{"old":"/__transmit/unsubscribe","type":0,"val":"unsubscribe","end":""}],
    types: placeholder as Registry['unsubscribe']['types'],
  },
  'locale.update': {
    methods: ["POST"],
    pattern: '/locale',
    tokens: [{"old":"/locale","type":0,"val":"locale","end":""}],
    types: placeholder as Registry['locale.update']['types'],
  },
  'home': {
    methods: ["GET","HEAD"],
    pattern: '/:locale',
    tokens: [{"old":"/:locale","type":1,"val":"locale","end":""}],
    types: placeholder as Registry['home']['types'],
  },
  'suppliers.index': {
    methods: ["GET","HEAD"],
    pattern: '/:locale/suppliers',
    tokens: [{"old":"/:locale/suppliers","type":1,"val":"locale","end":""},{"old":"/:locale/suppliers","type":0,"val":"suppliers","end":""}],
    types: placeholder as Registry['suppliers.index']['types'],
  },
  'suppliers.show': {
    methods: ["GET","HEAD"],
    pattern: '/:locale/suppliers/:slug',
    tokens: [{"old":"/:locale/suppliers/:slug","type":1,"val":"locale","end":""},{"old":"/:locale/suppliers/:slug","type":0,"val":"suppliers","end":""},{"old":"/:locale/suppliers/:slug","type":1,"val":"slug","end":""}],
    types: placeholder as Registry['suppliers.show']['types'],
  },
  'products.index': {
    methods: ["GET","HEAD"],
    pattern: '/:locale/products',
    tokens: [{"old":"/:locale/products","type":1,"val":"locale","end":""},{"old":"/:locale/products","type":0,"val":"products","end":""}],
    types: placeholder as Registry['products.index']['types'],
  },
  'products.show': {
    methods: ["GET","HEAD"],
    pattern: '/:locale/products/:slug',
    tokens: [{"old":"/:locale/products/:slug","type":1,"val":"locale","end":""},{"old":"/:locale/products/:slug","type":0,"val":"products","end":""},{"old":"/:locale/products/:slug","type":1,"val":"slug","end":""}],
    types: placeholder as Registry['products.show']['types'],
  },
  'new_account.create': {
    methods: ["GET","HEAD"],
    pattern: '/:locale/signup',
    tokens: [{"old":"/:locale/signup","type":1,"val":"locale","end":""},{"old":"/:locale/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['new_account.create']['types'],
  },
  'new_account.store': {
    methods: ["POST"],
    pattern: '/:locale/signup',
    tokens: [{"old":"/:locale/signup","type":1,"val":"locale","end":""},{"old":"/:locale/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['new_account.store']['types'],
  },
  'session.create': {
    methods: ["GET","HEAD"],
    pattern: '/:locale/login',
    tokens: [{"old":"/:locale/login","type":1,"val":"locale","end":""},{"old":"/:locale/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['session.create']['types'],
  },
  'session.store': {
    methods: ["POST"],
    pattern: '/:locale/login',
    tokens: [{"old":"/:locale/login","type":1,"val":"locale","end":""},{"old":"/:locale/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['session.store']['types'],
  },
  'session.destroy': {
    methods: ["POST"],
    pattern: '/:locale/logout',
    tokens: [{"old":"/:locale/logout","type":1,"val":"locale","end":""},{"old":"/:locale/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['session.destroy']['types'],
  },
  'onboarding.show': {
    methods: ["GET","HEAD"],
    pattern: '/:locale/onboarding',
    tokens: [{"old":"/:locale/onboarding","type":1,"val":"locale","end":""},{"old":"/:locale/onboarding","type":0,"val":"onboarding","end":""}],
    types: placeholder as Registry['onboarding.show']['types'],
  },
  'onboarding.store': {
    methods: ["POST"],
    pattern: '/:locale/onboarding',
    tokens: [{"old":"/:locale/onboarding","type":1,"val":"locale","end":""},{"old":"/:locale/onboarding","type":0,"val":"onboarding","end":""}],
    types: placeholder as Registry['onboarding.store']['types'],
  },
  'supplier.profile': {
    methods: ["GET","HEAD"],
    pattern: '/:locale/supplier/profile',
    tokens: [{"old":"/:locale/supplier/profile","type":1,"val":"locale","end":""},{"old":"/:locale/supplier/profile","type":0,"val":"supplier","end":""},{"old":"/:locale/supplier/profile","type":0,"val":"profile","end":""}],
    types: placeholder as Registry['supplier.profile']['types'],
  },
  'supplier.profile.update': {
    methods: ["PATCH"],
    pattern: '/:locale/supplier/profile',
    tokens: [{"old":"/:locale/supplier/profile","type":1,"val":"locale","end":""},{"old":"/:locale/supplier/profile","type":0,"val":"supplier","end":""},{"old":"/:locale/supplier/profile","type":0,"val":"profile","end":""}],
    types: placeholder as Registry['supplier.profile.update']['types'],
  },
  'supplier.products.index': {
    methods: ["GET","HEAD"],
    pattern: '/:locale/supplier/products',
    tokens: [{"old":"/:locale/supplier/products","type":1,"val":"locale","end":""},{"old":"/:locale/supplier/products","type":0,"val":"supplier","end":""},{"old":"/:locale/supplier/products","type":0,"val":"products","end":""}],
    types: placeholder as Registry['supplier.products.index']['types'],
  },
  'supplier.products.create': {
    methods: ["GET","HEAD"],
    pattern: '/:locale/supplier/products/new',
    tokens: [{"old":"/:locale/supplier/products/new","type":1,"val":"locale","end":""},{"old":"/:locale/supplier/products/new","type":0,"val":"supplier","end":""},{"old":"/:locale/supplier/products/new","type":0,"val":"products","end":""},{"old":"/:locale/supplier/products/new","type":0,"val":"new","end":""}],
    types: placeholder as Registry['supplier.products.create']['types'],
  },
  'supplier.products.store': {
    methods: ["POST"],
    pattern: '/:locale/supplier/products',
    tokens: [{"old":"/:locale/supplier/products","type":1,"val":"locale","end":""},{"old":"/:locale/supplier/products","type":0,"val":"supplier","end":""},{"old":"/:locale/supplier/products","type":0,"val":"products","end":""}],
    types: placeholder as Registry['supplier.products.store']['types'],
  },
  'supplier.products.edit': {
    methods: ["GET","HEAD"],
    pattern: '/:locale/supplier/products/:id/edit',
    tokens: [{"old":"/:locale/supplier/products/:id/edit","type":1,"val":"locale","end":""},{"old":"/:locale/supplier/products/:id/edit","type":0,"val":"supplier","end":""},{"old":"/:locale/supplier/products/:id/edit","type":0,"val":"products","end":""},{"old":"/:locale/supplier/products/:id/edit","type":1,"val":"id","end":""},{"old":"/:locale/supplier/products/:id/edit","type":0,"val":"edit","end":""}],
    types: placeholder as Registry['supplier.products.edit']['types'],
  },
  'supplier.products.update': {
    methods: ["POST"],
    pattern: '/:locale/supplier/products/:id',
    tokens: [{"old":"/:locale/supplier/products/:id","type":1,"val":"locale","end":""},{"old":"/:locale/supplier/products/:id","type":0,"val":"supplier","end":""},{"old":"/:locale/supplier/products/:id","type":0,"val":"products","end":""},{"old":"/:locale/supplier/products/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['supplier.products.update']['types'],
  },
  'supplier.products.destroy': {
    methods: ["DELETE"],
    pattern: '/:locale/supplier/products/:id',
    tokens: [{"old":"/:locale/supplier/products/:id","type":1,"val":"locale","end":""},{"old":"/:locale/supplier/products/:id","type":0,"val":"supplier","end":""},{"old":"/:locale/supplier/products/:id","type":0,"val":"products","end":""},{"old":"/:locale/supplier/products/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['supplier.products.destroy']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
