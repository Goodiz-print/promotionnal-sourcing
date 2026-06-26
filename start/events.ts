import emitter from '@adonisjs/core/services/emitter'
import UserRegistered from '#events/user_registered'
import UserLoggedIn from '#events/user_logged_in'

emitter.on(UserRegistered, [() => import('#listeners/on_user_registered'), 'handle'])
emitter.on(UserLoggedIn, [() => import('#listeners/on_user_logged_in'), 'handle'])
