import type User from '#models/user'

export default class UserRegistered {
  constructor(public user: User) {}
}
