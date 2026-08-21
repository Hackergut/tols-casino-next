import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query'],
  })

// Reuse one Prisma client per warm serverless instance. Creating a new client
// for every production invocation exhausts Supabase's session pool quickly.
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL) {
  globalForPrisma.prisma = db
}