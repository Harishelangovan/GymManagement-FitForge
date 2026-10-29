import { Check, Circle } from 'lucide-react'
import { PASSWORD_RULES } from '@/lib/validation'
import { cn } from '@/lib/cn'

/** Live checklist under a new-password field, so users know the rules before submitting. */
export function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value)
        return (
          <li key={rule.label} className={cn('flex items-center gap-1.5 text-xs', met ? 'text-success' : 'text-muted')}>
            {met ? <Check className="size-3.5" aria-hidden="true" /> : <Circle className="size-3" aria-hidden="true" />}
            {rule.label}
            <span className="sr-only">{met ? '(done)' : '(not yet)'}</span>
          </li>
        )
      })}
    </ul>
  )
}
