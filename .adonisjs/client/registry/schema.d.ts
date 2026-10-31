/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractRawResponse, ExtractResponse } from '@tuyau/core/types'
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
      rawResponse: ExtractRawResponse<unknown>
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
      rawResponse: ExtractRawResponse<unknown>
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
      rawResponse: ExtractRawResponse<unknown>
    }
  }
  'marketing.sitemap': {
    methods: ["GET","HEAD"]
    pattern: '/sitemap.xml'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/marketing_controller').default['sitemap']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/marketing_controller').default['sitemap']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/marketing_controller').default['sitemap']>>>
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/locale_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'health.show': {
    methods: ["GET","HEAD"]
    pattern: '/health'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/health_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/health_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/health_controller').default['show']>>>
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
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/marketing_controller').default['home']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/marketing_controller').default['home']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/marketing_controller').default['home']>>>
    }
  }
  'marketing.contact': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/contact'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/marketing_controller').default['contact']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/marketing_controller').default['contact']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/marketing_controller').default['contact']>>>
    }
  }
  'marketing.contact.store': {
    methods: ["POST"]
    pattern: '/:locale/contact'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/contact').contactRequestValidator)>>
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/contact').contactRequestValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/marketing_controller').default['sendContact']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/marketing_controller').default['sendContact']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/marketing_controller').default['sendContact']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'marketing.legal': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/legal'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/marketing_controller').default['legal']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/marketing_controller').default['legal']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/marketing_controller').default['legal']>>>
    }
  }
  'marketing.privacy': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/privacy'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/marketing_controller').default['privacy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/marketing_controller').default['privacy']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/marketing_controller').default['privacy']>>>
    }
  }
  'marketing.thanks': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/thanks'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/marketing_controller').default['thanks']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/marketing_controller').default['thanks']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/marketing_controller').default['thanks']>>>
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['index']>>>
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/suppliers_controller').default['show']>>>
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/products_controller').default['index']>>>
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/products_controller').default['show']>>>
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/organization/invitation_acceptance_controller').default['show']>>>
    }
  }
  'email.verify': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/email/verify/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/email_verification_controller').default['verify']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/email_verification_controller').default['verify']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/email_verification_controller').default['verify']>>>
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['create']>>>
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'agency_signup.create': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/signup/agency'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/agency_signup_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/agency_signup_controller').default['create']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/agency_signup_controller').default['create']>>>
    }
  }
  'agency_signup.store': {
    methods: ["POST"]
    pattern: '/:locale/signup/agency'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/agency_signup').agencySignupValidator)>>
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/agency_signup').agencySignupValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/agency_signup_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/agency_signup_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/agency_signup_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/session_controller').default['create']>>>
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/session_controller').default['store']>>>
    }
  }
  'passkey.login.options': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/passkeys/options'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/passkey_session_controller').default['options']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/passkey_session_controller').default['options']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/passkey_session_controller').default['options']>>>
    }
  }
  'passkey.login': {
    methods: ["POST"]
    pattern: '/:locale/passkeys/login'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/passkey').authenticatePasskeyValidator)>>
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/passkey').authenticatePasskeyValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/passkey_session_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/passkey_session_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/passkey_session_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'password.forgot': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/password/forgot'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/password_reset_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/password_reset_controller').default['create']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/password_reset_controller').default['create']>>>
    }
  }
  'password.email': {
    methods: ["POST"]
    pattern: '/:locale/password/forgot'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/password').forgotPasswordValidator)>>
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/password').forgotPasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/password_reset_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/password_reset_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/password_reset_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'password.reset': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/password/reset/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/password_reset_controller').default['edit']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/password_reset_controller').default['edit']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/password_reset_controller').default['edit']>>>
    }
  }
  'password.update': {
    methods: ["POST"]
    pattern: '/:locale/password/reset/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/password').resetPasswordValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/password').resetPasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/password_reset_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/password_reset_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/password_reset_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/session_controller').default['destroy']>>>
    }
  }
  'email.notice': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/email/verify'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/email_verification_controller').default['notice']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/email_verification_controller').default['notice']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/email_verification_controller').default['notice']>>>
    }
  }
  'email.verification.resend': {
    methods: ["POST"]
    pattern: '/:locale/email/verification/resend'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/email_verification_controller').default['resend']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/email_verification_controller').default['resend']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/email_verification_controller').default['resend']>>>
    }
  }
  'account.show': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/account'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/account_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/account_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/account_controller').default['show']>>>
    }
  }
  'account.update': {
    methods: ["PATCH"]
    pattern: '/:locale/account'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/account').updateAccountValidator)>>
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/account').updateAccountValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/account_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/account_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/account_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'account.password.update': {
    methods: ["PATCH"]
    pattern: '/:locale/account/password'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/account').updatePasswordValidator)>>
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/account').updatePasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/account_controller').default['updatePassword']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/account_controller').default['updatePassword']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/account_controller').default['updatePassword']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'account.destroy': {
    methods: ["DELETE"]
    pattern: '/:locale/account'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/account').destroyAccountValidator)>>
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/account').destroyAccountValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/account_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/account_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/account_controller').default['destroy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'account.passkeys.options': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/account/passkeys/options'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/passkey_controller').default['options']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/passkey_controller').default['options']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/passkey_controller').default['options']>>>
    }
  }
  'account.passkeys.store': {
    methods: ["POST"]
    pattern: '/:locale/account/passkeys'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/passkey').registerPasskeyValidator)>>
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/passkey').registerPasskeyValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/passkey_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/passkey_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/passkey_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'account.passkeys.update': {
    methods: ["PATCH"]
    pattern: '/:locale/account/passkeys/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/passkey').renamePasskeyValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/passkey').renamePasskeyValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/passkey_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/passkey_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/passkey_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'account.passkeys.destroy': {
    methods: ["DELETE"]
    pattern: '/:locale/account/passkeys/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/passkey_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/passkey_controller').default['destroy']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/passkey_controller').default['destroy']>>>
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/onboarding_controller').default['show']>>>
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/onboarding_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/organization/invitation_acceptance_controller').default['accept']>>>
    }
  }
  'dashboard.show': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/dashboard'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['show']>>>
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/organization/settings_controller').default['show']>>>
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/organization/settings_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'organization.switch': {
    methods: ["POST"]
    pattern: '/:locale/organization/switch/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/organization/lifecycle_controller').default['switch']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/organization/lifecycle_controller').default['switch']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/organization/lifecycle_controller').default['switch']>>>
    }
  }
  'organization.create': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/organization/new'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/organization/lifecycle_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/organization/lifecycle_controller').default['create']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/organization/lifecycle_controller').default['create']>>>
    }
  }
  'organization.store': {
    methods: ["POST"]
    pattern: '/:locale/organization/new'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/onboarding').onboardingValidator)>>
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/onboarding').onboardingValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/organization/lifecycle_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/organization/lifecycle_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/organization/lifecycle_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'organization.leave': {
    methods: ["DELETE"]
    pattern: '/:locale/organization/leave'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/organization/lifecycle_controller').default['leave']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/organization/lifecycle_controller').default['leave']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/organization/lifecycle_controller').default['leave']>>>
    }
  }
  'organization.archive': {
    methods: ["POST"]
    pattern: '/:locale/organization/archive'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/organization/lifecycle_controller').default['archive']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/organization/lifecycle_controller').default['archive']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/organization/lifecycle_controller').default['archive']>>>
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/organization/members_controller').default['index']>>>
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/organization/members_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/organization/members_controller').default['destroy']>>>
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/organization/invitations_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'organization.invitations.resend': {
    methods: ["POST"]
    pattern: '/:locale/organization/invitations/:id/resend'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/organization/invitations_controller').default['resend']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/organization/invitations_controller').default['resend']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/organization/invitations_controller').default['resend']>>>
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/organization/invitations_controller').default['destroy']>>>
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/profile_controller').default['show']>>>
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/profile_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/product_controller').default['index']>>>
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/product_controller').default['create']>>>
    }
  }
  'supplier.products.store': {
    methods: ["POST"]
    pattern: '/:locale/supplier/products'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/supplier_product').createSupplierProductValidator)>>
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/supplier_product').createSupplierProductValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/product_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/product_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/product_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/product_controller').default['edit']>>>
    }
  }
  'supplier.products.update': {
    methods: ["POST"]
    pattern: '/:locale/supplier/products/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/supplier_product').updateSupplierProductValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/supplier_product').updateSupplierProductValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/product_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/product_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/product_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/product_controller').default['destroy']>>>
    }
  }
  'supplier.documents.store': {
    methods: ["POST"]
    pattern: '/:locale/supplier/profile/documents'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/document').organizationDocumentValidator)>>
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/document').organizationDocumentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/document_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/document_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/document_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'supplier.documents.destroy': {
    methods: ["DELETE"]
    pattern: '/:locale/supplier/profile/documents/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/document_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/document_controller').default['destroy']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/document_controller').default['destroy']>>>
    }
  }
  'supplier.products.documents.store': {
    methods: ["POST"]
    pattern: '/:locale/supplier/products/:id/documents'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/document').productDocumentValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/document').productDocumentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/product_document_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/product_document_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/product_document_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'supplier.products.documents.destroy': {
    methods: ["DELETE"]
    pattern: '/:locale/supplier/products/:id/documents/:documentId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue; documentId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/product_document_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/product_document_controller').default['destroy']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/product_document_controller').default['destroy']>>>
    }
  }
  'rfqs.index': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/rfqs'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['index']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['index']>>>
    }
  }
  'rfqs.create': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/rfqs/new'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['create']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['create']>>>
    }
  }
  'rfqs.store': {
    methods: ["POST"]
    pattern: '/:locale/rfqs'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/rfq').rfqValidator)>>
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/rfq').rfqValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rfqs.show': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/rfqs/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['show']>>>
    }
  }
  'rfqs.update': {
    methods: ["PATCH"]
    pattern: '/:locale/rfqs/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/rfq').rfqValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/rfq').rfqValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rfqs.destroy': {
    methods: ["DELETE"]
    pattern: '/:locale/rfqs/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['destroy']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['destroy']>>>
    }
  }
  'rfqs.items.from_product': {
    methods: ["POST"]
    pattern: '/:locale/rfqs/:id/items/from-product'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/rfq').rfqProductValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/rfq').rfqProductValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['addProduct']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['addProduct']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['addProduct']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rfqs.suppliers.store': {
    methods: ["POST"]
    pattern: '/:locale/rfqs/:id/suppliers'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/rfq').rfqSuppliersValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/rfq').rfqSuppliersValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['addSuppliers']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['addSuppliers']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['addSuppliers']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rfqs.suppliers.destroy': {
    methods: ["DELETE"]
    pattern: '/:locale/rfqs/:id/suppliers/:supplierId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue; supplierId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['removeSupplier']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['removeSupplier']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['removeSupplier']>>>
    }
  }
  'rfqs.publish': {
    methods: ["POST"]
    pattern: '/:locale/rfqs/:id/publish'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['publish']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['publish']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['publish']>>>
    }
  }
  'rfqs.send': {
    methods: ["POST"]
    pattern: '/:locale/rfqs/:id/send'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['send']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['send']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['send']>>>
    }
  }
  'rfqs.close': {
    methods: ["POST"]
    pattern: '/:locale/rfqs/:id/close'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['close']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['close']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['close']>>>
    }
  }
  'rfqs.deadline.update': {
    methods: ["PATCH"]
    pattern: '/:locale/rfqs/:id/deadline'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/rfq').rfqDeadlineValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/rfq').rfqDeadlineValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['extendDeadline']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['extendDeadline']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/rfqs_controller').default['extendDeadline']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'supplier.rfqs.index': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/supplier/rfqs'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/rfqs_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/rfqs_controller').default['index']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/rfqs_controller').default['index']>>>
    }
  }
  'supplier.rfqs.show': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/supplier/rfqs/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/rfqs_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/rfqs_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/rfqs_controller').default['show']>>>
    }
  }
  'supplier.rfqs.decline': {
    methods: ["POST"]
    pattern: '/:locale/supplier/rfqs/:id/decline'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/rfqs_controller').default['decline']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/rfqs_controller').default['decline']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/rfqs_controller').default['decline']>>>
    }
  }
  'quotes.show': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/quotes/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/quotes_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/quotes_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/quotes_controller').default['show']>>>
    }
  }
  'quotes.accept': {
    methods: ["PATCH"]
    pattern: '/:locale/quotes/:id/accept'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/quotes_controller').default['accept']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/quotes_controller').default['accept']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/quotes_controller').default['accept']>>>
    }
  }
  'quotes.reject': {
    methods: ["PATCH"]
    pattern: '/:locale/quotes/:id/reject'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/quotes_controller').default['reject']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/quotes_controller').default['reject']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/quotes_controller').default['reject']>>>
    }
  }
  'supplier.quotes.index': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/supplier/quotes'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/quotes_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/quotes_controller').default['index']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/quotes_controller').default['index']>>>
    }
  }
  'supplier.quotes.create': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/supplier/rfqs/:rfqId/quotes/new'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; rfqId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/quotes_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/quotes_controller').default['create']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/quotes_controller').default['create']>>>
    }
  }
  'supplier.quotes.store': {
    methods: ["POST"]
    pattern: '/:locale/supplier/rfqs/:rfqId/quotes'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/quote').quoteValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; rfqId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/quote').quoteValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/quotes_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/quotes_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/quotes_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'supplier.quotes.show': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/supplier/quotes/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/quotes_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/quotes_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/quotes_controller').default['show']>>>
    }
  }
  'supplier.quotes.update': {
    methods: ["PATCH"]
    pattern: '/:locale/supplier/quotes/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/quote').quoteValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/quote').quoteValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/quotes_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/quotes_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/quotes_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'supplier.quotes.submit': {
    methods: ["POST"]
    pattern: '/:locale/supplier/quotes/:id/submit'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/quotes_controller').default['submit']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/quotes_controller').default['submit']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/quotes_controller').default['submit']>>>
    }
  }
  'supplier.quotes.destroy': {
    methods: ["DELETE"]
    pattern: '/:locale/supplier/quotes/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/quotes_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/quotes_controller').default['destroy']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/quotes_controller').default['destroy']>>>
    }
  }
  'orders.index': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/orders'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['index']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['index']>>>
    }
  }
  'orders.show': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/orders/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['show']>>>
    }
  }
  'orders.deliver': {
    methods: ["PATCH"]
    pattern: '/:locale/orders/:id/deliver'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['deliver']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['deliver']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['deliver']>>>
    }
  }
  'orders.cancel': {
    methods: ["PATCH"]
    pattern: '/:locale/orders/:id/cancel'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['cancel']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['cancel']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['cancel']>>>
    }
  }
  'supplier.orders.index': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/supplier/orders'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/orders_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/orders_controller').default['index']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/orders_controller').default['index']>>>
    }
  }
  'supplier.orders.show': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/supplier/orders/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/orders_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/orders_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/orders_controller').default['show']>>>
    }
  }
  'supplier.orders.confirm': {
    methods: ["PATCH"]
    pattern: '/:locale/supplier/orders/:id/confirm'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/orders_controller').default['confirm']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/orders_controller').default['confirm']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/orders_controller').default['confirm']>>>
    }
  }
  'supplier.orders.produce': {
    methods: ["PATCH"]
    pattern: '/:locale/supplier/orders/:id/produce'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/orders_controller').default['produce']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/orders_controller').default['produce']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/orders_controller').default['produce']>>>
    }
  }
  'supplier.orders.ship': {
    methods: ["PATCH"]
    pattern: '/:locale/supplier/orders/:id/ship'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/orders_controller').default['ship']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/orders_controller').default['ship']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/orders_controller').default['ship']>>>
    }
  }
  'supplier.orders.cancel': {
    methods: ["PATCH"]
    pattern: '/:locale/supplier/orders/:id/cancel'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/supplier/orders_controller').default['cancel']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/supplier/orders_controller').default['cancel']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/supplier/orders_controller').default['cancel']>>>
    }
  }
  'notifications.index': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/notifications'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['index']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['index']>>>
    }
  }
  'notifications.read': {
    methods: ["PATCH"]
    pattern: '/:locale/notifications/:id/read'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['read']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['read']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['read']>>>
    }
  }
  'notifications.readAll': {
    methods: ["POST"]
    pattern: '/:locale/notifications/read-all'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['readAll']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['readAll']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/notifications_controller').default['readAll']>>>
    }
  }
  'admin.dashboard': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/admin'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/dashboard_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/dashboard_controller').default['index']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/admin/dashboard_controller').default['index']>>>
    }
  }
  'admin.organizations.index': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/admin/organizations'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/organization_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/organization_controller').default['index']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/admin/organization_controller').default['index']>>>
    }
  }
  'admin.organizations.show': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/admin/organizations/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/organization_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/organization_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/admin/organization_controller').default['show']>>>
    }
  }
  'admin.users.index': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/admin/users'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/user_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/user_controller').default['index']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/admin/user_controller').default['index']>>>
    }
  }
  'admin.users.platform_role.update': {
    methods: ["PATCH"]
    pattern: '/:locale/admin/users/:id/platform-role'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/admin_user').updatePlatformRoleValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { locale: ParamValue; id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/admin_user').updatePlatformRoleValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/platform_role_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/platform_role_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/admin/platform_role_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'admin.audit.index': {
    methods: ["GET","HEAD"]
    pattern: '/:locale/admin/audit'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { locale: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/admin_audit').auditFiltersValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/admin/audit_log_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/admin/audit_log_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/admin/audit_log_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/admin/category_controller').default['index']>>>
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/admin/category_controller').default['create']>>>
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/admin/category_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/admin/category_controller').default['edit']>>>
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/admin/category_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/admin/category_controller').default['destroy']>>>
    }
  }
}
