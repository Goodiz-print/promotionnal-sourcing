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
      'users.support',
      'organizations.view',
      'products.view',
      'trade.view',
    ])
    assert.sameMembers(permissionsOf('moderator'), [
      'backoffice.access',
      'organizations.view',
      'products.view',
      'moderation.manage',
    ])
  })

  test('seul admin gere les organisations (archivage, modification, membres)', ({ assert }) => {
    assert.isTrue(platformRoleHasPermission('admin', 'organizations.manage'))
    for (const role of ['moderator', 'support', 'analyst'] as const) {
      assert.isFalse(platformRoleHasPermission(role, 'organizations.manage'), role)
    }
  })

  test('seul admin gère le catalogue produits, trois rôles le consultent', ({ assert }) => {
    for (const role of ['admin', 'moderator', 'support'] as const) {
      assert.isTrue(platformRoleHasPermission(role, 'products.view'), role)
    }
    assert.isFalse(platformRoleHasPermission('analyst', 'products.view'))
    assert.isTrue(platformRoleHasPermission('admin', 'products.manage'))
    for (const role of ['moderator', 'support', 'analyst'] as const) {
      assert.isFalse(platformRoleHasPermission(role, 'products.manage'), role)
    }
  })

  test('seul admin gère les utilisateurs (suspension, suppression)', ({ assert }) => {
    assert.isTrue(platformRoleHasPermission('admin', 'users.manage'))
    assert.isTrue(platformRoleHasPermission('admin', 'users.support'))
    for (const role of ['moderator', 'analyst'] as const) {
      assert.isFalse(platformRoleHasPermission(role, 'users.manage'), role)
      assert.isFalse(platformRoleHasPermission(role, 'users.support'), role)
    }
    // Support a users.support mais pas users.manage
    assert.isTrue(platformRoleHasPermission('support', 'users.support'))
    assert.isFalse(platformRoleHasPermission('support', 'users.manage'))
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

  test('seul admin envoie des annonces à la plateforme', ({ assert }) => {
    assert.isTrue(platformRoleHasPermission('admin', 'announcements.manage'))
    for (const role of ['moderator', 'support', 'analyst'] as const) {
      assert.isFalse(platformRoleHasPermission(role, 'announcements.manage'), role)
    }
  })

  test('seul admin suit et relance les imports', ({ assert }) => {
    assert.isTrue(platformRoleHasPermission('admin', 'imports.manage'))
    for (const role of ['moderator', 'support', 'analyst'] as const) {
      assert.isFalse(platformRoleHasPermission(role, 'imports.manage'), role)
    }
  })
})
