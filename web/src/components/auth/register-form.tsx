"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { registerSchema, type RegisterValues } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/auth/field";

export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { weightUnit: "KG" },
  });

  async function onSubmit(values: RegisterValues) {
    setFormError(null);
    // The server re-validates both values; the browser timezone is a sensible default.
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
      weightUnit: values.weightUnit,
      timezone,
    });
    if (error) {
      setFormError(
        error.status === 429
          ? "Too many attempts. Try again in a minute."
          : (error.message ?? "Could not create your account."),
      );
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5" noValidate>
      <Field id="name" label="Name" error={errors.name?.message}>
        <Input
          id="name"
          autoComplete="name"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "name-error" : undefined}
          {...register("name")}
        />
      </Field>
      <Field id="email" label="Email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
      </Field>
      <Field id="password" label="Password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
          {...register("password")}
        />
      </Field>
      <Field id="confirmPassword" label="Confirm password" error={errors.confirmPassword?.message}>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword}
          aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
          {...register("confirmPassword")}
        />
      </Field>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Weight unit</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["KG", "LB"] as const).map((unit) => (
            <label
              key={unit}
              className="flex h-10 cursor-pointer items-center justify-center rounded-md border border-input text-sm font-medium transition-colors has-[:checked]:border-ring has-[:checked]:bg-accent has-[:checked]:text-accent-foreground has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring"
            >
              <input type="radio" value={unit} className="sr-only" {...register("weightUnit")} />
              {unit === "KG" ? "Kilograms (kg)" : "Pounds (lb)"}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">You can change this later in settings.</p>
      </fieldset>
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Create account
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
