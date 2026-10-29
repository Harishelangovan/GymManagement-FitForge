import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' }

/**
 * Built on the native <dialog> element: the browser handles focus trapping, Escape to close,
 * the backdrop and making the rest of the page inert.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()} // click on the backdrop
      aria-labelledby="modal-title"
      className={cn(
        'm-auto w-[calc(100%-2rem)] rounded-card border border-border bg-surface p-0 text-fg shadow-card',
        'backdrop:bg-black/60 backdrop:backdrop-blur-sm',
        SIZES[size],
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h2 id="modal-title" className="text-lg font-semibold">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="max-h-[70dvh] overflow-y-auto px-5 py-4">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
    </dialog>
  )
}
