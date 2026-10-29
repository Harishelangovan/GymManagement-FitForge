import { CalendarDays, Dumbbell, ShieldCheck } from 'lucide-react'
import { Link, Outlet } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'

const CURRENT_YEAR = new Date().getFullYear()

const HIGHLIGHTS = [
  { icon: Dumbbell, title: 'Plans that move with you', text: 'Workout and diet plans from your trainer, updated in real time.' },
  { icon: CalendarDays, title: 'Book classes in seconds', text: 'See open spots, book, and cancel up to two hours before.' },
  { icon: ShieldCheck, title: 'Private by design', text: 'Your data is visible only to you, your trainer and gym staff.' },
]

/** Split screen for sign-in pages: brand panel on large screens, centred form everywhere. */
export function AuthLayout() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-border bg-surface lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="pointer-events-none absolute -top-40 -left-40 size-[28rem] rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />

        <Link to="/login" className="relative">
          <Logo className="text-2xl" />
        </Link>

        <div className="relative max-w-md">
          {/* A styled paragraph, not a heading: each page's own <h1> (e.g. "Sign in") is the page's main heading. */}
          <p className="font-display text-4xl leading-tight font-bold tracking-tight text-fg xl:text-5xl">
            Train harder.
            <br />
            <span className="text-accent-text">Run the gym smarter.</span>
          </p>
          <ul className="mt-10 space-y-6">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-surface-2 text-accent-text">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold text-fg">{title}</span>
                  <span className="block text-sm text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-subtle">© {CURRENT_YEAR} FitForge</p>
      </aside>

      <main className="relative flex flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between lg:justify-end">
          <Link to="/login" className="lg:hidden" aria-label="FitForge">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
