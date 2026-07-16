import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { isAllowedEmail } from '@/lib/allowlist'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/signin', error: '/signin' },
  trustHost: true,
  callbacks: {
    signIn({ user }) {
      return isAllowedEmail(user.email)
    },
  },
})
