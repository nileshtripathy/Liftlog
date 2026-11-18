import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { isValidTimezone } from "@/lib/timezone";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS,
  database: prismaAdapter(db, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: true,
    // Email verification / password reset need a mail provider: tracked as a follow-up.
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    // No cookieCache: a cached cookie keeps a signed-out/revoked session alive until it expires.
    // Every request validates the session row so sign-out and revocation are immediate.
  },

  // Persist counters in Postgres so limits hold across serverless instances.
  rateLimit: { enabled: true, storage: "database", window: 60, max: 60 },

  user: {
    additionalFields: {
      // Client-settable at sign-up, but coerced/validated in the hook below.
      weightUnit: { type: "string", required: false, defaultValue: "KG", input: true },
      timezone: { type: "string", required: false, defaultValue: "UTC", input: true },
      // Not settable by clients (prevents mass-assignment at sign-up).
      goalDaysPerWeek: { type: "number", required: false, defaultValue: 4, input: false },
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const u = user as typeof user & { weightUnit?: unknown; timezone?: unknown };
          return {
            data: {
              ...user,
              weightUnit: u.weightUnit === "LB" ? "LB" : "KG",
              timezone: isValidTimezone(u.timezone) ? u.timezone : "UTC",
            },
          };
        },
      },
    },
  },

  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },

  plugins: [nextCookies()], // must remain the last plugin
});

export type Auth = typeof auth;
