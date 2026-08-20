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
  'products.index': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/products'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['index']>>>
    }
  }
  'products.show': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/products/:slug'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; slug: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/products_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/products_controller').default['show']>>>
    }
  }
  'organization.invitations.show': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/organization/invitations/:id/accept'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/organization/invitation_acceptance_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/organization/invitation_acceptance_controller').default['show']>>>
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
  'organization.invitations.accept': {
    methods: ["POST"]
    pattern: '/:locale/organization/invitations/:id/accept'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/organization/invitation_acceptance_controller').default['accept']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/organization/invitation_acceptance_controller').default['accept']>>>
    }
  }
  'organization.settings': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/organization/settings'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/organization/settings_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/organization/settings_controller').default['show']>>>
    }
  }
  'organization.settings.update': {
    methods: ["POST"]
    pattern: '/:locale/organization/settings'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/organization').updateOrganizationValidator)>>
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/organization').updateOrganizationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/organization/settings_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/organization/settings_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'organization.members': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/organization/members'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/organization/members_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/organization/members_controller').default['index']>>>
    }
  }
  'organization.members.update': {
    methods: ["PATCH"]
    pattern: '/:locale/organization/members/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/organization_member').updateMemberRoleValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/organization_member').updateMemberRoleValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/organization/members_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/organization/members_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'organization.members.destroy': {
    methods: ["DELETE"]
    pattern: '/:locale/organization/members/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/organization/members_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/organization/members_controller').default['destroy']>>>
    }
  }
  'organization.invitations.store': {
    methods: ["POST"]
    pattern: '/:locale/organization/invitations'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/organization_invitation').inviteMemberValidator)>>
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/organization_invitation').inviteMemberValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/organization/invitations_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/organization/invitations_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'organization.invitations.destroy': {
    methods: ["DELETE"]
    pattern: '/:locale/organization/invitations/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/organization/invitations_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/organization/invitations_controller').default['destroy']>>>
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
  'supplier.products.index': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/supplier/products'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/product_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/product_controller').default['index']>>>
    }
  }
  'supplier.products.create': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/supplier/products/new'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/product_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/product_controller').default['create']>>>
    }
  }
  'supplier.products.store': {
    methods: ["POST"]
    pattern: '/:locale/supplier/products'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/supplier_product').supplierProductValidator)>>
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/supplier_product').supplierProductValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/product_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/product_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'supplier.products.edit': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/supplier/products/:id/edit'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/product_controller').default['edit']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/product_controller').default['edit']>>>
    }
  }
  'supplier.products.update': {
    methods: ["POST"]
    pattern: '/:locale/supplier/products/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/supplier_product').supplierProductValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/supplier_product').supplierProductValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/product_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/product_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'supplier.products.destroy': {
    methods: ["DELETE"]
    pattern: '/:locale/supplier/products/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/product_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/product_controller').default['destroy']>>>
    }
  }
  'admin.categories.index': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/admin/categories'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/category_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/category_controller').default['index']>>>
    }
  }
  'admin.categories.create': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/admin/categories/new'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/category_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/category_controller').default['create']>>>
    }
  }
  'admin.categories.store': {
    methods: ["POST"]
    pattern: '/:locale/admin/categories'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/category').createCategoryValidator)>>
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/category').createCategoryValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/category_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/category_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.categories.edit': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/admin/categories/:id/edit'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/category_controller').default['edit']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/category_controller').default['edit']>>>
    }
  }
  'admin.categories.update': {
    methods: ["PATCH"]
    pattern: '/:locale/admin/categories/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/category').updateCategoryValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/category').updateCategoryValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/category_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/category_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.categories.destroy': {
    methods: ["DELETE"]
    pattern: '/:locale/admin/categories/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/category_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/category_controller').default['destroy']>>>
    }
  }
}
