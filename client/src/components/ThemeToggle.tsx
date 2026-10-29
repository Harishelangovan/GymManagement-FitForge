import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/theme/themeContext'
import { Button } from './ui/Button'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const nextLabel = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={nextLabel} title={nextLabel}>
      {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  )
}
