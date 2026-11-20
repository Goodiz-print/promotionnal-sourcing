import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import type User from '#models/user'
import OnboardedMiddleware from '#middleware/onboarded_middleware'
import OrganizationContextService from '#services/organization_context_service'

/** Faux contexte d'organisation : résultat piloté par le test, appels comptés. */
class FakeOrganizationContext extends OrganizationContextService {
  calls = 0

  constructor(private usable: boolean) {
    super()
  }

  async ensureUsableOrganization(): Promise<boolean> {
    this.calls += 1
    return this.usable
  }
}

interface FakeRequest {
  ctx: HttpContext
  redirectedTo: () => { route: string; params: unknown } | null
}

/** Contexte HTTP minimal : seuls `auth.user`, `i18n.locale` et la redirection servent. */
function fakeHttpContext(user: User | undefined): FakeRequest {
  let redirectedTo: { route: string; params: unknown } | null = null
  const ctx = {
    auth: { user },
    i18n: { locale: 'fr' },
    response: {
      redirect: () => ({
        toRoute: (route: string, params: unknown) => {
          redirectedTo = { route, params }
        },
      }),
    },
  } as unknown as HttpContext
  return { ctx, redirectedTo: () => redirectedTo }
}

const user = { id: 1 } as User

test.group('OnboardedMiddleware', () => {
  test('sans utilisateur, laisse passer sans consulter le contexte', async ({ assert }) => {
    const context = new FakeOrganizationContext(false)
    const request = fakeHttpContext(undefined)
    let nextCalled = false

    await new OnboardedMiddleware(context).handle(request.ctx, async () => {
      nextCalled = true
    })

    assert.isTrue(nextCalled)
    assert.equal(context.calls, 0)
    assert.isNull(request.redirectedTo())
  })

  test('avec une organisation utilisable, laisse passer', async ({ assert }) => {
    const context = new FakeOrganizationContext(true)
    const request = fakeHttpContext(user)
    let nextCalled = false

    await new OnboardedMiddleware(context).handle(request.ctx, async () => {
      nextCalled = true
    })

    assert.isTrue(nextCalled)
    assert.equal(context.calls, 1)
    assert.isNull(request.redirectedTo())
  })

  test("sans organisation utilisable, redirige vers l'onboarding", async ({ assert }) => {
    const context = new FakeOrganizationContext(false)
    const request = fakeHttpContext(user)
    let nextCalled = false

    await new OnboardedMiddleware(context).handle(request.ctx, async () => {
      nextCalled = true
    })

    assert.isFalse(nextCalled)
    assert.deepEqual(request.redirectedTo(), {
      route: 'onboarding.show',
      params: { locale: 'fr' },
    })
  })
})
