'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useTheme } from './ThemeProvider'
import { LayoutDashboard, Video, Zap, Calendar, Activity, Settings, ScrollText, LogOut, Moon, Sun, ShieldCheck, BarChart3, Search, FileText, Info } from 'lucide-react'

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/vmrs/static', label: 'Static VMRs', icon: Video },
  { href: '/vmrs/dynamic', label: 'Dynamic VMRs', icon: Zap },
  { href: '/vmrs/scheduled', label: 'Scheduled VMRs', icon: Calendar },
  { href: '/realtime', label: 'Real-time', icon: Activity },
  { href: '/quality', label: 'Quality', icon: ShieldCheck },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/logs', label: 'Logs', icon: ScrollText },
  { href: '/reports', label: 'Executive Report', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/about', label: 'About', icon: Info },
]

export function TopNavbar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { theme, toggleTheme } = useTheme()

  // Hide navbar on login/setup pages
  if (pathname === '/login' || pathname === '/setup') {
    return null
  }

  // Show a loading skeleton while session is being resolved
  if (status === 'loading') {
    return (
      <header className="glass-card sticky top-0 z-50 shadow-glass">
        <div className="flex items-center gap-6 px-6 h-16">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <span className="text-white font-bold text-xs">P</span>
            </div>
            <span className="text-sm font-bold text-gray-900 dark:text-white">Pexip Reports</span>
          </div>
          <nav className="flex items-center gap-1 overflow-x-auto flex-1">
            {links.map(({ href, label, icon: Icon }) => (
              <span key={href} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap">
                <Icon size={14} />
                {label}
              </span>
            ))}
          </nav>
        </div>
      </header>
    )
  }

  // Hide navbar when not authenticated
  if (status !== 'authenticated') {
    return null
  }

  return (
    <header className="glass-card sticky top-0 z-50 shadow-glass">
      <div className="flex items-center gap-4 px-6 h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-md shadow-primary-500/20">
            <span className="text-white font-bold text-xs">P</span>
          </div>
          <span className="text-sm font-bold text-gray-900 dark:text-white hidden sm:block">Pexip Reports</span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-0.5 overflow-x-auto flex-1 ml-2 scrollbar-hide">
          {links.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? 'bg-primary-500/15 text-primary-700 dark:text-primary-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100/60 dark:hover:bg-white/5'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-primary-600 dark:text-primary-400' : ''} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Right side controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100/60 dark:hover:bg-white/5 transition-colors"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="flex items-center gap-2 pl-2 border-l border-gray-200/60 dark:border-gray-700/40">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 hidden md:block">{session?.user?.name}</span>
            <button
              onClick={async () => {
                await signOut({ redirect: false })
                window.location.assign('/login')
              }}
              className="p-2 rounded-xl text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/5 transition-colors"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
