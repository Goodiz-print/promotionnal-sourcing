import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class MainSeeder extends BaseSeeder {
  private async seed(Seeder: { default: typeof BaseSeeder }) {
    await new Seeder.default(this.client).run()
  }

  async run() {
    await this.seed(await import('./role_seeder.js'))
    await this.seed(await import('./permission_seeder.js'))
    await this.seed(await import('./role_permission_seeder.js'))
    await this.seed(await import('./dev_user_seeder.js'))
  }
}
