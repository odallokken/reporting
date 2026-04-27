'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useTheme } from './ThemeProvider'
import { LayoutDashboard, Video, Zap, Calendar, Activity, Settings, ScrollText, LogOut, Moon, Sun, ShieldCheck, BarChart3, Search, FileText } from 'lucide-react'

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/vmrs/static', label: 'Static VMRs', icon: Video },
  { href: '/vmrs/dynamic', label: 'Dynamic VMRs', icon: Zap },
  { href: '/vmrs/scheduled', label: 'Scheduled VMRs', icon: Calendar },
  { href: '/realtime', label: 'Real-time', icon: Activity },
  { href: '/quality', label: 'Call Quality', icon: ShieldCheck },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/logs', label: 'Logs', icon: ScrollText },
  { href: '/reports', label: 'Executive Report', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { theme, toggleTheme } = useTheme()

  // Hide sidebar on login/setup pages
  if (pathname === '/login' || pathname === '/setup') {
    return null
  }

  // Show a loading skeleton while session is being resolved
  if (status === 'loading') {
    return (
      <aside className="w-64 min-h-screen bg-white dark:bg-surface-dark-alt border-r border-gray-200 dark:border-gray-700/50 flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 dark:text-white">Pexip Reports</h1>
              <p className="text-xs text-gray-400 dark:text-gray-500">Analytics Dashboard</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {links.map(({ href, label, icon: Icon }) => (
            <div key={href} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 dark:text-gray-500">
              <Icon size={18} />
              {label}
            </div>
          ))}
        </nav>
      </aside>
    )
  }

  // Hide sidebar when not authenticated (middleware will redirect to login)
  if (status !== 'authenticated') {
    return null
  }

  return (
    <aside className="w-64 min-h-screen bg-white dark:bg-surface-dark-alt border-r border-gray-200 dark:border-gray-700/50 flex flex-col">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 dark:text-white">Pexip Reports</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">Analytics Dashboard</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-primary-500' : ''} />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="p-3 border-t border-gray-200 dark:border-gray-700/50 space-y-2">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
        <div className="flex items-center justify-between px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{session?.user?.name}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Signed in</p>
          </div>
          <button
            onClick={async () => {
              await signOut({ redirect: false })
              window.location.assign('/login')
            }}
            className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
