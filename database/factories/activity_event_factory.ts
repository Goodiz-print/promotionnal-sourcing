import factory from '@adonisjs/lucid/factories'
import ActivityEvent from '#models/activity_event'

export const ActivityEventFactory = factory
  .define(ActivityEvent, ({ faker }) => ({
    type: 'product_viewed' as const,
    targetType: 'product' as const,
    targetId: faker.number.int({ min: 1, max: 10_000 }),
  }))
  .build()
