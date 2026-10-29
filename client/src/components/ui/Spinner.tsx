import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Logo } from '../brand/Logo'

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn('size-5 animate-spin', className)} aria-hidden="true" />
}

/** Shown while the app checks for an existing session on first load. */
export function FullPageLoader() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <Logo className="text-2xl" />
        <Spinner className="text-accent-text" />
        <span className="sr-only">Loading FitForge…</span>
      </div>
    </div>
  )
}
