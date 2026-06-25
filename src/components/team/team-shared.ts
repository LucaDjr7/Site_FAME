import type { Role } from '@/types'

/**
 * Maps each Role enum value to the i18n key suffix used by useTranslations('team').
 * Shared across MemberCard, EditMemberModal, InviteModal.
 */
export const ROLE_KEY: Record<Role, string> = {
  direction: 'roles.direction',
  researcher: 'roles.researchers',
  phd: 'roles.phd',
  engineering: 'roles.engineering',
}

/** Ordered list of all roles for selects/dropdowns. */
export const ROLES: Role[] = ['direction', 'researcher', 'phd', 'engineering']
