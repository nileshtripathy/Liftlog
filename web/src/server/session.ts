import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";

/** Current session or null. Memoised per request. */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

/**
 * Authorization gate for server components / actions / route handlers.
 * The proxy only does an optimistic cookie check: this is the real check.
 * Every data query must then be scoped by the returned user's id.
 */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}
