import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { Input } from './Input'
import { Modal } from './Modal'

/** One row of filters above a list (wraps on small screens). */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>
}

/** Search box that waits until typing pauses (300 ms) before reporting, so the API isn't called on every keystroke. */
export function SearchInput({ value, onChange, placeholder = 'Search…', label = 'Search' }: { value: string; onChange: (value: string) => void; placeholder?: string; label?: string }) {
  const [text, setText] = useState(value)
  const reported = useRef(value)

  useEffect(() => {
    if (text === reported.current) return
    const timer = setTimeout(() => {
      reported.current = text
      onChange(text.trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [text, onChange])

  return (
    <div className="relative w-full sm:max-w-xs">
      <Input type="search" aria-label={label} placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} leftIcon={<Search className="size-4" />} />
    </div>
  )
}

/** Segmented control for 2–4 mutually exclusive options (tabs, filters). */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex w-fit rounded-xl border border-border bg-surface p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
            value === option.value ? 'bg-accent-soft text-accent-text' : 'text-muted hover:text-fg',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Accessible on/off switch. */
export function Switch({ checked, onChange, label, description, id }: { checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string; id: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
        </label>
        {description && <p className="text-xs text-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors', checked ? 'bg-accent' : 'bg-surface-3')}
      >
        <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
      </button>
    </div>
  )
}

/** Yes/no confirmation for destructive actions (cancel, deactivate). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
  loading,
  destructive = true,
}: {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
  loading?: boolean
  destructive?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Keep it
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-muted">{description}</div>
    </Modal>
  )
}

/** Small "clear filters" link shown when any filter is active. */
export function ClearFilters({ visible, onClear }: { visible: boolean; onClear: () => void }) {
  if (!visible) return null
  return (
    <button type="button" onClick={onClear} className="inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-muted hover:text-fg">
      <X className="size-4" aria-hidden="true" /> Clear filters
    </button>
  )
}
