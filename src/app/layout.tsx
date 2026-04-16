import type { Metadata } from 'next'
import './globals.css'
import { TopNavbar } from '@/components/TopNavbar'
import { AuthProvider } from '@/components/AuthProvider'
import { ThemeProvider } from '@/components/ThemeProvider'

export const metadata: Metadata = {
  title: 'Pexip Reporting Dashboard',
  description: 'Analytics and reporting for Pexip Infinity',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <AuthProvider>
          <ThemeProvider>
            <div className="min-h-screen bg-surface dark:bg-surface-dark">
              <TopNavbar />
              <main className="overflow-auto">
                {children}
              </main>
            </div>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
