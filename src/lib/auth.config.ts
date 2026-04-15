import type { NextAuthConfig } from 'next-auth'

const publicPaths = ['/login', '/setup', '/api/auth', '/api/events']

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  providers: [],  // providers are added in auth.ts (Node.js runtime only)
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const { pathname } = nextUrl

      // Allow public paths
      if (publicPaths.some(p => pathname.startsWith(p))) {
        return true
      }

      // Allow static assets and Next.js internals
      if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.startsWith('/fonts')) {
        return true
      }

      // Only allow access if the user has a valid session
      return !!auth?.user
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? ''
        ;(session.user as { role?: string }).role = token.role as string
      }
      return session
    },
  },
  session: {
    strategy: 'jwt',
  },
} satisfies NextAuthConfig
