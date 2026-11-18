import "server-only";
import { z } from "zod";

/**
 * Validated, typed server environment. Fails fast at startup (and at build) with the
 * NAMES of invalid variables only; values are never printed.
 */
const schema = z.object({
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((v) => /^postgres(ql)?:\/\//.test(v), "must be a postgres:// connection string"),
  BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
  BETTER_AUTH_URL: z.url(),
  BETTER_AUTH_TRUSTED_ORIGINS: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    ),
});

function load() {
  const raw = {
    ...process.env,
    // Vercel preview deployments expose their host as VERCEL_URL.
    BETTER_AUTH_URL:
      process.env.BETTER_AUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
  };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}\nSee .env.example.`);
  }
  return parsed.data;
}

export const env = load();
