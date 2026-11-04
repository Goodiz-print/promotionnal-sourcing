import { test } from '@japa/runner'
import { platformRoleHasPermission } from '#shared/helpers/platform_permissions'
import {
  PLATFORM_PERMISSIONS,
  PLATFORM_ROLES,
  PLATFORM_ROLE_PERMISSIONS,
  type PlatformPermission,
  type PlatformRole,
} from '#shared/types/user'

function permissionsOf(role: PlatformRole): PlatformPermission[] {
  return PLATFORM_PERMISSIONS.filter((permission) => platformRoleHasPermission(role, permission))
}

test.group('Droits des rôles plateforme', () => {
  test('chaque rôle est défini dans la matrice', ({ assert }) => {
    assert.sameMembers(Object.keys(PLATFORM_ROLE_PERMISSIONS), [...PLATFORM_ROLES])
  })

  test('« none » n’a aucun droit, y compris sans rôle connu', ({ assert }) => {
    assert.deepEqual(permissionsOf('none'), [])
    assert.isFalse(platformRoleHasPermission(undefined, 'backoffice.access'))
    assert.isFalse(platformRoleHasPermission(null, 'backoffice.access'))
  })

  test('admin porte tous les droits', ({ assert }) => {
    assert.sameMembers(permissionsOf('admin'), [...PLATFORM_PERMISSIONS])
  })

  test('tout rôle fin passe la porte d’entrée du back-office', ({ assert }) => {
    for (const role of ['moderator', 'support', 'analyst'] as const) {
      assert.isTrue(platformRoleHasPermission(role, 'backoffice.access'), role)
    }
  })

  test('seul admin gère les rôles, la taxonomie et lit l’audit', ({ assert }) => {
    for (const role of ['moderator', 'support', 'analyst'] as const) {
      assert.isFalse(platformRoleHasPermission(role, 'roles.manage'), role)
      assert.isFalse(platformRoleHasPermission(role, 'catalogue.manage'), role)
      assert.isFalse(platformRoleHasPermission(role, 'audit.view'), role)
    }
  })

  test('analyst est en lecture seule : monitoring, ni comptes ni organisations', ({ assert }) => {
    assert.sameMembers(permissionsOf('analyst'), [
      'backoffice.access',
      'monitoring.view',
      'trade.view',
    ])
  })

  test('support consulte comptes et organisations, moderator les organisations', ({ assert }) => {
    assert.sameMembers(permissionsOf('support'), [
      'backoffice.access',
      'users.view',
      'organizations.view',
      'trade.view',
    ])
    assert.sameMembers(permissionsOf('moderator'), [
      'backoffice.access',
      'organizations.view',
      'moderation.manage',
    ])
  })

  test('seul admin intervient sur les demandes de devis, trois rôles les consultent', ({
    assert,
  }) => {
    for (const role of ['admin', 'support', 'analyst'] as const) {
      assert.isTrue(platformRoleHasPermission(role, 'trade.view'), role)
    }
    assert.isFalse(platformRoleHasPermission('moderator', 'trade.view'))
    assert.isTrue(platformRoleHasPermission('admin', 'trade.manage'))
    for (const role of ['moderator', 'support', 'analyst'] as const) {
      assert.isFalse(platformRoleHasPermission(role, 'trade.manage'), role)
    }
  })
})
