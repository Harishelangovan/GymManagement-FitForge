import { membersApi, membershipsApi, trainersApi } from '@/api/resources'
import { formatCurrency, formatDate } from '@/lib/format'
import type { PickerOption } from './EntityPicker'

// Search functions for <EntityPicker>. Each asks the API (which applies the caller's permissions),
// so a trainer's member picker only ever offers their own members.

export const searchMembers = async (term: string): Promise<PickerOption[]> =>
  (await membersApi.list({ search: term, pageSize: 8, isActive: true })).items.map((m) => ({
    id: m.id,
    label: `${m.firstName} ${m.lastName}`,
    detail: m.email,
  }))

export const searchTrainers = async (term: string): Promise<PickerOption[]> =>
  (await trainersApi.list({ search: term, pageSize: 8, isActive: true })).items.map((t) => ({
    id: t.id,
    label: `${t.firstName} ${t.lastName}`,
    detail: t.specialization,
  }))

/** Memberships with something left to pay (for recording payments). */
export const searchMembershipsWithBalance = async (term: string): Promise<PickerOption[]> =>
  (await membershipsApi.list({ search: term, pageSize: 20 })).items
    .filter((m) => m.balance > 0 && m.state !== 'Cancelled')
    .map((m) => ({
      id: m.id,
      label: `${m.memberName} — ${m.planName}`,
      detail: `${formatCurrency(m.balance)} due · ends ${formatDate(m.endDate)}`,
    }))
