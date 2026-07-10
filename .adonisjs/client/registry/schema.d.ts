/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'event_stream': {
    methods: ["GET","HEAD"]
    pattern: '/__transmit/events'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'subscribe': {
    methods: ["POST"]
    pattern: '/__transmit/subscribe'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'unsubscribe': {
    methods: ["POST"]
    pattern: '/__transmit/unsubscribe'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'locale.update': {
    methods: ["POST"]
    pattern: '/locale'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/locale').updateLocaleValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/locale').updateLocaleValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/locale_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/locale_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'home': {
    methods: ["GET","HEAD"]
    pattern: '/:locale'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'suppliers.index': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/suppliers'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['index']>>>
    }
  }
  'suppliers.show': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/suppliers/:slug'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; slug: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['show']>>>
    }
  }
  'new_account.create': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/signup'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['create']>>>
    }
  }
  'new_account.store': {
    methods: ["POST"]
    pattern: '/:locale/signup'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').signupValidator)>>
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/user').signupValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'session.create': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/login'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['create']>>>
    }
  }
  'session.store': {
    methods: ["POST"]
    pattern: '/:locale/login'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['store']>>>
    }
  }
  'session.destroy': {
    methods: ["POST"]
    pattern: '/:locale/logout'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['destroy']>>>
    }
  }
  'onboarding.show': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/onboarding'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/onboarding_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/onboarding_controller').default['show']>>>
    }
  }
  'onboarding.store': {
    methods: ["POST"]
    pattern: '/:locale/onboarding'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/onboarding').onboardingValidator)>>
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/onboarding').onboardingValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/onboarding_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/onboarding_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'supplier.profile': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/supplier/profile'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/profile_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/profile_controller').default['show']>>>
    }
  }
  'supplier.profile.update': {
    methods: ["PATCH"]
    pattern: '/:locale/supplier/profile'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/supplier_profile').updateSupplierProfileValidator)>>
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/supplier_profile').updateSupplierProfileValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/profile_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/profile_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
}
