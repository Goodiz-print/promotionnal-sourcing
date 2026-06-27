import Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'
import Role from '#models/role'
import User from '#models/user'
import hash from '@adonisjs/core/services/hash'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class DevUserSeeder extends BaseSeeder {
  async run() {
    const ownerRole = await Role.findByOrFail('slug', 'owner')

    const user = await User.updateOrCreate(
      { email: 'malolebrin@gmail.com' },
      {
        fullName: 'Malo Lebrin',
        password: await hash.make('password'),
      }
    )

    const org = await Organization.updateOrCreate(
      { slug: 'promotionnal-sourcing' },
      {
        name: 'Promotionnal Sourcing',
        slug: 'promotionnal-sourcing',
        country: 'FR',
      }
    )

    await OrganizationUser.updateOrCreate(
      { userId: user.id, organizationId: org.id },
      { roleId: ownerRole.id }
    )

    await user.merge({ currentOrganizationId: org.id }).save()
  }
}
