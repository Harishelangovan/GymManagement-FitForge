import { cn } from '@/lib/cn'

/** Text logo: "Fit" in the foreground colour, "Forge" in lime, with a small forged-"F" mark. */
export function Logo({ className, showMark = true }: { className?: string; showMark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-display text-xl font-bold tracking-tight', className)}>
      {showMark && (
        <svg viewBox="0 0 32 32" className="size-[1.4em] shrink-0" aria-hidden="true">
          <rect width="32" height="32" rx="8" className="fill-fg" />
          <path d="M9 23V9h13M9 16h9" fill="none" className="stroke-bg" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="23" cy="22" r="2.4" className="fill-accent" />
        </svg>
      )}
      <span>
        Fit<span className="text-accent-text">Forge</span>
      </span>
    </span>
  )
}
