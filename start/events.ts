import emitter from '@adonisjs/core/services/emitter'
import UserRegistered from '#events/user_registered'
import UserLoggedIn from '#events/user_logged_in'
import MailDeliveryFailed from '#events/mail_delivery_failed'

emitter.on(UserRegistered, [() => import('#listeners/on_user_registered'), 'handle'])
emitter.on(UserLoggedIn, [() => import('#listeners/on_user_logged_in'), 'handle'])
emitter.on(MailDeliveryFailed, [() => import('#listeners/on_mail_delivery_failed'), 'handle'])
