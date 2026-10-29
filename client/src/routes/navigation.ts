import {
  BadgeCheck,
  CalendarDays,
  ClipboardCheck,
  Dumbbell,
  LayoutDashboard,
  Salad,
  ShieldCheck,
  Tags,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '@/api/types'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
}

/** Sidebar items per role (the first item is the role's dashboard). */
export const NAVIGATION: Record<Role, NavItem[]> = {
  Admin: [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { label: 'Members', path: '/admin/members', icon: Users },
    { label: 'Trainers', path: '/admin/trainers', icon: Dumbbell },
    { label: 'Plans', path: '/admin/plans', icon: Tags },
    { label: 'Memberships', path: '/admin/memberships', icon: BadgeCheck },
    { label: 'Payments', path: '/admin/payments', icon: Wallet },
    { label: 'Classes', path: '/admin/classes', icon: CalendarDays },
    { label: 'Attendance', path: '/admin/attendance', icon: ClipboardCheck },
    { label: 'Audit log', path: '/admin/audit-logs', icon: ShieldCheck },
  ],
  Trainer: [
    { label: 'Dashboard', path: '/trainer', icon: LayoutDashboard },
    { label: 'My members', path: '/trainer/members', icon: Users },
    { label: 'Workout plans', path: '/trainer/workouts', icon: Dumbbell },
    { label: 'Diet plans', path: '/trainer/diets', icon: Salad },
    { label: 'Classes', path: '/trainer/classes', icon: CalendarDays },
    { label: 'Attendance', path: '/trainer/attendance', icon: ClipboardCheck },
  ],
  Member: [
    { label: 'Dashboard', path: '/member', icon: LayoutDashboard },
    { label: 'Membership', path: '/member/membership', icon: BadgeCheck },
    { label: 'Workouts', path: '/member/workouts', icon: Dumbbell },
    { label: 'Diet', path: '/member/diet', icon: Salad },
    { label: 'Classes', path: '/member/classes', icon: CalendarDays },
    { label: 'Attendance', path: '/member/attendance', icon: ClipboardCheck },
    { label: 'Payments', path: '/member/payments', icon: Wallet },
  ],
}
