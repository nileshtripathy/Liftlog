/**
 * Import legacy LiftLog (SQLite/Express) workouts into the new PostgreSQL schema.
 *
 *   npm run import:legacy -- --file ../migration/exports/live-<ts>.json                      # DRY RUN (default, no DB access)
 *   npm run import:legacy -- --file <export.json> --email you@example.com --apply            # writes, in ONE transaction
 *
 * Options: --timezone <IANA>  (dry-run default UTC; --apply defaults to the user's saved timezone)
 *          --report <file>    write the full JSON report (plan + quarantined rows)
 *
 * Safe to re-run: rows already imported (matched by legacyId) are skipped.
 * Credentials come from the environment (DIRECT_URL preferred, else DATABASE_URL); nothing is printed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { planImport, type LegacyRow } from "../src/lib/legacy-import/plan";
import { isValidTimezone } from "../src/lib/timezone";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(name);
function fail(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

const file = arg("--file") ?? fail("--file <export.json> is required");
const apply = has("--apply");
const email = arg("--email");
const tzArg = arg("--timezone");
if (tzArg && !isValidTimezone(tzArg)) fail(`unknown timezone "${tzArg}"`);
if (apply && !email) fail("--apply requires --email <existing user's email>");

const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
const rows: LegacyRow[] = Array.isArray(parsed) ? parsed : (parsed as { rows?: LegacyRow[] }).rows ?? fail("file has no rows[]");

function report(label: string, timezone: string, plan: ReturnType<typeof planImport>) {
  console.log(`\n${label}  (timezone: ${timezone}, weights treated as kg)`);
  console.log(`  legacy rows:        ${plan.stats.rows}`);
  console.log(`  importable:         ${plan.stats.imported}`);
  console.log(`  quarantined:        ${plan.stats.quarantined}`);
  console.log(`  workout sessions:   ${plan.stats.sessions}  (one per calendar day)`);
  console.log(`  distinct exercises: ${plan.stats.exercises}`);
  for (const q of plan.quarantined) console.log(`    - row id ${String(q.id)}: ${q.reason}`);
  const outFile = arg("--report");
  if (outFile) {
    writeFileSync(outFile, JSON.stringify(plan, null, 2));
    console.log(`  report written to ${outFile}`);
  }
}

async function main() {
  if (!apply) {
    const timezone = tzArg ?? "UTC";
    report("DRY RUN — nothing was written", timezone, planImport(rows, { timezone }));
    console.log("\nRe-run with --email <user> --apply to import.");
    return;
  }

  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? fail("DIRECT_URL or DATABASE_URL must be set");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const user = await prisma.user.findUnique({ where: { email: email!.trim().toLowerCase() } });
    if (!user) fail("no user with that email: register in the app first, then import");
    const timezone = tzArg ?? user.timezone;
    const plan = planImport(rows, { timezone });
    report("IMPORT PLAN", timezone, plan);

    const result = await prisma.$transaction(
      async (tx) => {
        const allIds = plan.sessions.flatMap((s) => s.exercises.flatMap((e) => e.sets.map((x) => x.legacyId)));
        const existing = await tx.setLog.findMany({
          where: { legacyId: { in: allIds } },
          select: { legacyId: true, sessionExercise: { select: { session: { select: { userId: true } } } } },
        });
        if (existing.some((e) => e.sessionExercise.session.userId !== user.id))
          throw new Error("some legacy ids were already imported by a DIFFERENT user; aborting");
        const done = new Set(existing.map((e) => e.legacyId));

        const exerciseCache = new Map<string, string>();
        const counts = { sessions: 0, exercisesCreated: 0, sets: 0, skipped: done.size };

        for (const s of plan.sessions) {
          const fresh = s.exercises
            .map((e) => ({ ...e, sets: e.sets.filter((x) => !done.has(x.legacyId)) }))
            .filter((e) => e.sets.length > 0);
          if (fresh.length === 0) continue;

          let session = await tx.workoutSession.findFirst({
            where: { userId: user.id, source: "LEGACY_IMPORT", startedAt: s.startedAt },
          });
          if (!session) {
            session = await tx.workoutSession.create({
              data: { userId: user.id, name: s.name, startedAt: s.startedAt, endedAt: s.endedAt, source: "LEGACY_IMPORT" },
            });
            counts.sessions++;
          }

          for (const e of fresh) {
            let exerciseId = exerciseCache.get(e.normalizedName);
            if (!exerciseId) {
              const found =
                (await tx.exercise.findFirst({ where: { normalizedName: e.normalizedName, userId: null } })) ??
                (await tx.exercise.findFirst({ where: { normalizedName: e.normalizedName, userId: user.id } }));
              if (found) exerciseId = found.id;
              else {
                exerciseId = (
                  await tx.exercise.create({
                    data: { userId: user.id, name: e.displayName, normalizedName: e.normalizedName },
                  })
                ).id;
                counts.exercisesCreated++;
              }
              exerciseCache.set(e.normalizedName, exerciseId);
            }

            let se = await tx.sessionExercise.findFirst({ where: { sessionId: session.id, exerciseId } });
            if (!se) {
              const position = await tx.sessionExercise.count({ where: { sessionId: session.id } });
              se = await tx.sessionExercise.create({ data: { sessionId: session.id, exerciseId, position } });
            }
            let next = (await tx.setLog.count({ where: { sessionExerciseId: se.id } })) + 1;
            for (const x of e.sets) {
              await tx.setLog.create({
                data: {
                  sessionExerciseId: se.id,
                  setNumber: next++,
                  weightKg: x.weightKg,
                  reps: x.reps,
                  completedAt: x.completedAt,
                  legacyId: x.legacyId,
                },
              });
              counts.sets++;
            }
          }
          if (s.endedAt > (session.endedAt ?? s.startedAt))
            await tx.workoutSession.update({ where: { id: session.id }, data: { endedAt: s.endedAt } });
        }
        return counts;
      },
      { timeout: 60_000 },
    );

    console.log(
      `\nAPPLIED: ${result.sets} sets, ${result.sessions} new sessions, ${result.exercisesCreated} new custom exercises; ${result.skipped} already-imported rows skipped.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
