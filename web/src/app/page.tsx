import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

// Temporary minimal home. The full GSAP landing page is a later roadmap step.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 px-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="grid gap-4">
        <p className="font-mono text-sm text-primary">LiftLog</p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
          Log every set. See real progress.
        </h1>
        <p className="max-w-xl text-pretty text-lg text-muted-foreground">
          A focused workout tracker that remembers your weights and reps, so you can keep lifting with confidence.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/register">Create account</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </main>
  );
}
