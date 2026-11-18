-- Data-integrity rules Prisma's schema language cannot express.
-- These are the DB-level backstop for the Zod validation in the app layer
-- (the legacy SQLite app accepted negative, non-numeric and absurd values).

-- Global (userId IS NULL) library exercises: NULLs are distinct in a normal
-- unique index, so enforce one global row per normalized name explicitly.
CREATE UNIQUE INDEX "exercises_global_normalizedName_key"
  ON "exercises"("normalizedName") WHERE "userId" IS NULL;

ALTER TABLE "users"
  ADD CONSTRAINT "users_goalDaysPerWeek_range" CHECK ("goalDaysPerWeek" BETWEEN 1 AND 7),
  ADD CONSTRAINT "users_timezone_not_empty" CHECK (length("timezone") > 0);

ALTER TABLE "exercises"
  ADD CONSTRAINT "exercises_name_not_empty" CHECK (length(btrim("name")) > 0),
  ADD CONSTRAINT "exercises_normalizedName_not_empty" CHECK (length("normalizedName") > 0);

ALTER TABLE "routine_exercises"
  ADD CONSTRAINT "routine_exercises_position_nonneg" CHECK ("position" >= 0),
  ADD CONSTRAINT "routine_exercises_targetSets_range" CHECK ("targetSets" BETWEEN 1 AND 100),
  ADD CONSTRAINT "routine_exercises_targetReps_range" CHECK ("targetReps" BETWEEN 1 AND 1000),
  ADD CONSTRAINT "routine_exercises_targetWeightKg_range" CHECK ("targetWeightKg" IS NULL OR "targetWeightKg" BETWEEN 0 AND 5000);

ALTER TABLE "workout_sessions"
  ADD CONSTRAINT "workout_sessions_end_after_start" CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt");

ALTER TABLE "session_exercises"
  ADD CONSTRAINT "session_exercises_position_nonneg" CHECK ("position" >= 0);

-- weight 0 is valid (bodyweight / empty bar) — the legacy API wrongly rejected it.
ALTER TABLE "set_logs"
  ADD CONSTRAINT "set_logs_setNumber_positive" CHECK ("setNumber" >= 1),
  ADD CONSTRAINT "set_logs_weightKg_range" CHECK ("weightKg" BETWEEN 0 AND 5000),
  ADD CONSTRAINT "set_logs_reps_range" CHECK ("reps" BETWEEN 1 AND 1000),
  ADD CONSTRAINT "set_logs_rpe_range" CHECK ("rpe" IS NULL OR "rpe" BETWEEN 1 AND 10);

-- Account deletion cascades users -> exercises AND users -> workout_sessions -> session_exercises
-- in one statement. Postgres evaluates nested cascades in constraint-name order, so a plain
-- immediate FK would reject the exercise delete before the history rows are gone.
-- Deferring the check to COMMIT lets all cascades finish first, while deleting a still-referenced
-- exercise on its own is still rejected (at commit).
ALTER TABLE "routine_exercises" ALTER CONSTRAINT "routine_exercises_exerciseId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "session_exercises" ALTER CONSTRAINT "session_exercises_exerciseId_fkey" DEFERRABLE INITIALLY DEFERRED;
