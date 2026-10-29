import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { cn } from '@/lib/cn'
import { Input } from './ui/Input'
import { Spinner } from './ui/Spinner'

export interface PickerOption {
  id: number
  label: string
  detail?: string
}

interface EntityPickerProps {
  /** Unique cache key for this kind of search, e.g. "member-picker". */
  name: string
  search: (term: string) => Promise<PickerOption[]>
  value: PickerOption | null
  onChange: (option: PickerOption | null) => void
  placeholder?: string
  invalid?: boolean
  inputId?: string
  disabled?: boolean
}

/**
 * Search-as-you-type picker (ARIA combobox) for choosing a member, membership or trainer from the API.
 * Results load after typing pauses; arrow keys + Enter select; the choice shows as a removable chip.
 */
export function EntityPicker({ name, search, value, onChange, placeholder = 'Search…', invalid, inputId, disabled }: EntityPickerProps) {
  const listId = useId()
  const [text, setText] = useState('')
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setTerm(text.trim()), 250)
    return () => clearTimeout(timer)
  }, [text])

  const results = useQuery({ queryKey: [name, term], queryFn: () => search(term), enabled: open && !value, staleTime: 15_000 })
  const options = results.data ?? []

  if (value) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border bg-surface-2 px-3.5 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-fg">{value.label}</p>
          {value.detail && <p className="truncate text-xs text-muted">{value.detail}</p>}
        </div>
        {!disabled && (
          <button type="button" onClick={() => onChange(null)} className="grid size-7 cursor-pointer place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-fg" aria-label={`Clear ${value.label}`}>
            <X className="size-4" />
          </button>
        )}
      </div>
    )
  }

  const choose = (option: PickerOption) => {
    onChange(option)
    setOpen(false)
    setText('')
  }

  return (
    <div className="relative">
      <Input
        id={inputId}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        placeholder={placeholder}
        value={text}
        disabled={disabled}
        leftIcon={<Search className="size-4" />}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setText(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((i) => Math.min(i + 1, options.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter' && options[active]) {
            e.preventDefault()
            choose(options[active])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {open && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-surface py-1 shadow-card">
          {results.isFetching && options.length === 0 ? (
            <li className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-muted">
              <Spinner className="size-4" /> Searching…
            </li>
          ) : options.length === 0 ? (
            <li className="px-3.5 py-2.5 text-sm text-muted">No matches</li>
          ) : (
            options.map((option, index) => (
              <li
                key={option.id}
                role="option"
                aria-selected={index === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(option)}
                onMouseEnter={() => setActive(index)}
                className={cn('cursor-pointer px-3.5 py-2', index === active && 'bg-surface-2')}
              >
                <p className="text-sm font-medium text-fg">{option.label}</p>
                {option.detail && <p className="text-xs text-muted">{option.detail}</p>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
