import type User from '#models/user'

export default class UserLoggedIn {
  constructor(public user: User) {}
}
