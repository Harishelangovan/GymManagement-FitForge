import { clsx, type ClassValue } from 'clsx'

/** Joins conditional class names: cn('px-4', isActive && 'bg-accent'). */
export function cn(...values: ClassValue[]): string {
  return clsx(values)
}
