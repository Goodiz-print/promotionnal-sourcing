import { test } from '@japa/runner'
import { runAdAuction } from '#shared/helpers/ad_auction'
import { AD_MIN_CPC_CENTS, type AdAuctionCandidate } from '#shared/types/ads'

const candidate = (
  campaignId: number,
  maxCpcCents: number,
  organizationId = campaignId
): AdAuctionCandidate => ({ campaignId, productId: campaignId * 10, organizationId, maxCpcCents })

test.group('Produits sponsorisés — enchère au second prix', () => {
  test('classe par enchère décroissante et limite au nombre d’emplacements', ({ assert }) => {
    const winners = runAdAuction([candidate(1, 40), candidate(2, 90), candidate(3, 60)], 2)
    assert.deepEqual(
      winners.map((winner) => winner.campaignId),
      [2, 3]
    )
  })

  test('chaque gagnant paie l’enchère suivante plus un centime', ({ assert }) => {
    const winners = runAdAuction([candidate(1, 40), candidate(2, 90), candidate(3, 60)], 3)
    assert.deepEqual(
      winners.map((winner) => winner.costCents),
      [61, 41, AD_MIN_CPC_CENTS]
    )
  })

  test('un candidat seul paie le prix plancher, pas son enchère', ({ assert }) => {
    const [winner] = runAdAuction([candidate(1, 500)], 3)
    assert.equal(winner.costCents, AD_MIN_CPC_CENTS)
  })

  test('le prix ne dépasse jamais l’enchère maximale du gagnant', ({ assert }) => {
    // Égalité : « suivante + 1 » dépasserait l'enchère du premier.
    const winners = runAdAuction([candidate(1, 50), candidate(2, 50)], 2)
    assert.deepEqual(
      winners.map((winner) => [winner.campaignId, winner.costCents]),
      [
        [1, 50],
        [2, AD_MIN_CPC_CENTS],
      ]
    )
  })

  test('à égalité, la campagne la plus ancienne passe devant', ({ assert }) => {
    const winners = runAdAuction([candidate(7, 50), candidate(3, 50)], 1)
    assert.equal(winners[0].campaignId, 3)
  })

  test('une organisation n’occupe qu’un emplacement et n’enchérit pas contre elle-même', ({
    assert,
  }) => {
    const winners = runAdAuction(
      [candidate(1, 90, 100), candidate(2, 80, 100), candidate(3, 30)],
      3
    )
    assert.deepEqual(
      winners.map((winner) => [winner.campaignId, winner.costCents]),
      [
        [1, 31],
        [3, AD_MIN_CPC_CENTS],
      ]
    )
  })

  test('aucun candidat ou aucun emplacement : aucun gagnant', ({ assert }) => {
    assert.deepEqual(runAdAuction([], 3), [])
    assert.deepEqual(runAdAuction([candidate(1, 50)], 0), [])
  })
})
