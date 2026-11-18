import type { Metadata } from "next";
import { db } from "@/server/db";
import { requireUser } from "@/server/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  // Always scoped by the authenticated user's id (user-level data isolation).
  const workoutCount = await db.workoutSession.count({ where: { userId: user.id } });

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.name}</h1>
        <p className="text-muted-foreground">
          Units: {user.weightUnit === "LB" ? "pounds" : "kilograms"} · Timezone: {user.timezone}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{workoutCount === 0 ? "No workouts yet" : `${workoutCount} workouts logged`}</CardTitle>
          <CardDescription>
            {workoutCount === 0
              ? "Workout logging arrives in the next milestone. Your account, preferences and data isolation are live."
              : "Detailed stats arrive with the dashboard milestone."}
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
