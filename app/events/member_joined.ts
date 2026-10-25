import type Organization from '#models/organization'
import type User from '#models/user'

/** Un utilisateur vient de rejoindre une organisation en acceptant une invitation. */
export default class MemberJoined {
  constructor(
    public organization: Organization,
    public user: User
  ) {}
}
