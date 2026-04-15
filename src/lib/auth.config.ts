import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  providers: [],  // providers are added in auth.ts (Node.js runtime only)
  callbacks: {
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
