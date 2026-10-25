import emitter from '@adonisjs/core/services/emitter'
import UserRegistered from '#events/user_registered'
import UserLoggedIn from '#events/user_logged_in'
import MailDeliveryFailed from '#events/mail_delivery_failed'
import ProductChanged from '#events/product_changed'
import OrganizationCatalogueChanged from '#events/organization_catalogue_changed'
import QuoteSubmitted from '#events/quote_submitted'
import QuoteAccepted from '#events/quote_accepted'
import QuoteRejected from '#events/quote_rejected'
import RfqSent from '#events/rfq_sent'
import RfqDeclined from '#events/rfq_declined'
import MemberJoined from '#events/member_joined'

emitter.on(UserRegistered, [() => import('#listeners/on_user_registered'), 'handle'])
emitter.on(UserLoggedIn, [() => import('#listeners/on_user_logged_in'), 'handle'])
emitter.on(MailDeliveryFailed, [() => import('#listeners/on_mail_delivery_failed'), 'handle'])
emitter.on(QuoteSubmitted, [() => import('#listeners/on_quote_submitted'), 'handle'])
emitter.on(QuoteAccepted, [() => import('#listeners/on_quote_accepted'), 'handle'])
emitter.on(QuoteRejected, [() => import('#listeners/on_quote_rejected'), 'handle'])
emitter.on(RfqSent, [() => import('#listeners/on_rfq_sent'), 'handle'])
emitter.on(RfqDeclined, [() => import('#listeners/on_rfq_declined'), 'handle'])
emitter.on(MemberJoined, [() => import('#listeners/on_member_joined'), 'handle'])
emitter.on(ProductChanged, [() => import('#listeners/on_product_changed'), 'handle'])
emitter.on(OrganizationCatalogueChanged, [
  () => import('#listeners/on_organization_catalogue_changed'),
  'handle',
])
