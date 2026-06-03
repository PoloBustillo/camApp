import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import { authorizeCredentials } from "@/lib/authorize"
import { prisma } from "@/lib/prisma"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null
        const { email, password } = parsed.data
        return authorizeCredentials(email, password)
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.role = (user as { role: string }).role
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id
      session.user.role = token.role
      return session
    },
  },
  events: {
    async signOut(message) {
      const userId = "token" in message ? (message.token?.id as string | undefined) : undefined
      if (userId) {
        prisma.auditLog.create({
          data: {
            userId,
            action: "user_logout",
            resourceType: "user",
            resourceId: userId,
          },
        }).catch(() => {})
      }
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
})
