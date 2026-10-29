import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/auth/AuthProvider'
import { queryClient } from '@/lib/queryClient'
import { router } from '@/routes/router'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { useTheme } from '@/theme/themeContext'

function ThemedToaster() {
  const { theme } = useTheme()
  // Bottom-right: top-right would cover the user menu and theme toggle in the top bar.
  return <Toaster theme={theme} position="bottom-right" richColors closeButton toastOptions={{ className: 'font-sans' }} />
}

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
          <ThemedToaster />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
