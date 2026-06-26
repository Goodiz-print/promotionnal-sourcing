# Système d'événements (Emitter)

L'emitter AdonisJS est intégré dans `@adonisjs/core` — aucune installation supplémentaire.

## Structure

```
app/events/          # Classes d'événements
app/listeners/       # Listeners (handlers)
start/events.ts      # Enregistrement des bindings event → listener
```

## Émettre un événement

```typescript
import emitter from '@adonisjs/core/services/emitter'
import UserRegistered from '#events/user_registered'

await emitter.emit(UserRegistered, new UserRegistered(user))
```

## Ajouter un nouvel événement

**1. Créer la classe event** (`app/events/order_created.ts`) :

```typescript
import type Order from '#models/order'

export default class OrderCreated {
  constructor(public order: Order) {}
}
```

**2. Créer le listener** (`app/listeners/on_order_created.ts`) :

```typescript
import type OrderCreated from '#events/order_created'
import logger from '@adonisjs/core/services/logger'

export default class OnOrderCreated {
  async handle(event: OrderCreated) {
    logger.info({ orderId: event.order.id }, 'order created')
  }
}
```

**3. Enregistrer le binding** dans `start/events.ts` :

```typescript
import OrderCreated from '#events/order_created'

emitter.on(OrderCreated, [() => import('#listeners/on_order_created'), 'handle'])
```

## Plusieurs listeners sur un même événement

```typescript
emitter.on(UserRegistered, [() => import('#listeners/on_user_registered'), 'handle'])
emitter.on(UserRegistered, [() => import('#listeners/send_welcome_email'), 'handle'])
```

## Écoute ponctuelle (une seule fois)

```typescript
emitter.once(UserRegistered, [() => import('#listeners/on_user_registered'), 'handle'])
```

## Références

- [AdonisJS Emitter — documentation officielle](https://docs.adonisjs.com/guides/digging-deeper/emitter)
