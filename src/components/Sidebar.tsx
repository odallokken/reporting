'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { LayoutDashboard, Video, VideoOff, Calendar, Activity, Settings, ScrollText, LogOut } from 'lucide-react'

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/vmrs/static', label: 'Static VMRs', icon: Video },
  { href: '/vmrs/dynamic', label: 'Dynamic VMRs', icon: VideoOff },
  { href: '/vmrs/scheduled', label: 'Scheduled VMR calls', icon: Calendar },
  { href: '/realtime', label: 'Real-time', icon: Activity },
  { href: '/logs', label: 'Logs', icon: ScrollText },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()

  // Hide sidebar on login/setup pages
  if (pathname === '/login' || pathname === '/setup') {
    return null
  }

  // Show a loading skeleton while session is being resolved
  if (status === 'loading') {
    return (
      <aside className="w-64 min-h-screen bg-gray-900 text-white flex flex-col">
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-xl font-bold text-white">Pexip Reports</h1>
          <p className="text-xs text-gray-400 mt-1">Analytics Dashboard</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {links.map(({ href, label, icon: Icon }) => (
            <div key={href} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-300">
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
    <aside className="w-64 min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold text-white">Pexip Reports</h1>
        <p className="text-xs text-gray-400 mt-1">Analytics Dashboard</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm text-gray-300 truncate">{session?.user?.name}</p>
            <p className="text-xs text-gray-500">Signed in</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-gray-800"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
