import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { authConfig } from '@/lib/auth.config'

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const username = credentials?.username
        const password = credentials?.password

        if (typeof username !== 'string' || typeof password !== 'string') {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { username },
        })

        if (!user) return null

        const isValid = await compare(password, user.passwordHash)
        if (!isValid) return null

        return {
          id: String(user.id),
          name: user.username,
          role: user.role,
        }
      },
    }),
  ],
})
