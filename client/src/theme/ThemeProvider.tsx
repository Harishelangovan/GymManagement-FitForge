import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeContext, type Theme } from './themeContext'

const STORAGE_KEY = 'fitforge-theme' // only a display preference; no personal data is ever stored in the browser

function readInitialTheme(): Theme {
  const current = document.documentElement.dataset.theme // set by the inline script in index.html
  return current === 'light' ? 'light' : 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readInitialTheme)

  // Synchronises React state with things outside React: the <html> attribute, the browser UI colour and storage.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0f1112' : '#f5f5f0')
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Storage can be blocked (private mode); the theme still works for this visit.
    }
  }, [theme])

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])
  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme])

  return <ThemeContext value={value}>{children}</ThemeContext>
}
