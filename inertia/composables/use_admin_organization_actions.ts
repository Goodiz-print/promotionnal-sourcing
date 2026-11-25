import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import { useConfirm } from '~/composables/use_confirm'
import type { ConfirmOptions } from '~/types/ui'
import type { OrganizationKind } from '#shared/types/organization'

/**
 * Actions d'administration d'une organisation (#161) : chaque mutation est une
 * visite Inertia (`preserveScroll`), le serveur répond par une redirection + flash.
 * `processing` est vrai pendant la requête : les boutons s'en servent pour se
 * désactiver. Les actions destructives demandent une confirmation (`confirmation`, fenêtre `useConfirm`) ;
 * refusée, aucune requête ne part.
 */
export function useAdminOrganizationActions(organizationId: number) {
  const { locale } = useI18n()
  const { confirm } = useConfirm()

  const processing = ref(false)

  const visitOptions = {
    preserveScroll: true,
    onStart: () => (processing.value = true),
    onFinish: () => (processing.value = false),
  }

  const base = () => ({ locale: locale.value, id: organizationId })

  async function archive(confirmation: ConfirmOptions) {
    if (!(await confirm(confirmation))) return
    router.post(urlFor('admin.organizations.archive', base()), {}, visitOptions)
  }

  async function restore(confirmation: ConfirmOptions) {
    if (!(await confirm(confirmation))) return
    router.post(urlFor('admin.organizations.restore', base()), {}, visitOptions)
  }

  function changeType(organizationType: OrganizationKind) {
    router.patch(
      urlFor('admin.organizations.change_type', base()),
      { organizationType },
      visitOptions
    )
  }

  function changeMemberRole(membershipId: number, roleId: number) {
    router.patch(
      urlFor('admin.organizations.member_role', { ...base(), membershipId }),
      { roleId },
      visitOptions
    )
  }

  async function removeMember(membershipId: number, confirmation: ConfirmOptions) {
    if (!(await confirm(confirmation))) return
    router.delete(
      urlFor('admin.organizations.remove_member', { ...base(), membershipId }),
      visitOptions
    )
  }

  async function revokeInvitation(invitationId: number, confirmation: ConfirmOptions) {
    if (!(await confirm(confirmation))) return
    router.delete(
      urlFor('admin.organizations.revoke_invitation', { ...base(), invitationId }),
      visitOptions
    )
  }

  async function resendInvitation(invitationId: number, confirmation: ConfirmOptions) {
    if (!(await confirm(confirmation))) return
    router.post(
      urlFor('admin.organizations.resend_invitation', { ...base(), invitationId }),
      {},
      visitOptions
    )
  }

  return {
    processing,
    archive,
    restore,
    changeType,
    changeMemberRole,
    removeMember,
    revokeInvitation,
    resendInvitation,
  }
}
