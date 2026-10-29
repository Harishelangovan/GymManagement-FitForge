import { ChevronDown, LogOut, Menu, Settings, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCurrentUser, useAuth } from '@/auth/authContext'
import { Logo } from '@/components/brand/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Avatar, Badge } from '@/components/ui/Feedback'
import { cn } from '@/lib/cn'
import { NAVIGATION } from '@/routes/navigation'

/** Signed-in layout: sidebar (drawer on mobile), top bar with theme toggle and user menu, page content. */
export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-surface lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm" aria-label="Close menu" onClick={() => setDrawerOpen(false)} />
          <aside className="relative h-full w-72 max-w-[85vw] border-r border-border bg-surface shadow-card">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute top-4 right-3 grid size-9 cursor-pointer place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
            {/* Picking a link closes the drawer. */}
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <TopBar onOpenMenu={() => setDrawerOpen(true)} />

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  )
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const user = useCurrentUser()
  const items = NAVIGATION[user.role]

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Link to="/" onClick={onNavigate} aria-label="FitForge home">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Main">
        <p className="px-3 pb-2 text-[11px] font-semibold tracking-widest text-subtle uppercase">{user.role} workspace</p>
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                onClick={onNavigate}
                end={item.path.split('/').length === 2} // dashboard links match exactly
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-accent-soft text-accent-text' : 'text-muted hover:bg-surface-2 hover:text-fg',
                  )
                }
              >
                <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-border p-3">
        <NavLink
          to="/settings"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              isActive ? 'bg-accent-soft text-accent-text' : 'text-muted hover:bg-surface-2 hover:text-fg',
            )
          }
        >
          <Settings className="size-[18px]" aria-hidden="true" />
          Account settings
        </NavLink>
      </div>
    </div>
  )
}

function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <button
        onClick={onOpenMenu}
        className="grid size-10 cursor-pointer place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>
      <Link to="/" className="lg:hidden" aria-label="FitForge home">
        <Logo showMark={false} className="text-lg" />
      </Link>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}

function UserMenu() {
  const user = useCurrentUser()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const fullName = `${user.firstName} ${user.lastName}`

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const signOut = async () => {
    setSigningOut(true)
    try {
      await logout()
      toast.success('You have been signed out.')
    } catch {
      toast.info('Signed out on this device.') // the local session is cleared even if the API call failed
    } finally {
      navigate('/login', { replace: true })
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex cursor-pointer items-center gap-2.5 rounded-xl py-1.5 pr-2 pl-1.5 hover:bg-surface-2"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar name={fullName} className="size-8" />
        <span className="hidden text-left sm:block">
          <span className="block max-w-40 truncate text-sm font-semibold text-fg">{fullName}</span>
          <span className="block text-xs text-muted">{user.role}</span>
        </span>
        <ChevronDown className="hidden size-4 text-subtle sm:block" aria-hidden="true" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-surface shadow-card">
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-semibold text-fg">{fullName}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            <Badge tone="accent" className="mt-2">
              {user.role}
            </Badge>
          </div>
          <div className="p-1.5">
            <Link role="menuitem" to="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-fg hover:bg-surface-2">
              <Settings className="size-4 text-muted" aria-hidden="true" />
              Account settings
            </Link>
            <button
              role="menuitem"
              onClick={signOut}
              disabled={signingOut}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger-soft disabled:opacity-50"
            >
              <LogOut className="size-4" aria-hidden="true" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
