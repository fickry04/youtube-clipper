import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import prisma from "@/lib/prisma";
import { nextCookies } from 'better-auth/next-js';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // refresh if 1 day old
  },
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  ],
  plugins: [nextCookies()]
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
