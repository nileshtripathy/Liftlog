import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/lib/validation/auth";
import { isValidTimezone } from "@/lib/timezone";

const valid = {
  name: "  Nilesh  ",
  email: "  Test@Example.COM ",
  password: "correct-horse-battery",
  confirmPassword: "correct-horse-battery",
  weightUnit: "LB" as const,
};

describe("registerSchema", () => {
  it("normalises name and email", () => {
    const r = registerSchema.parse(valid);
    expect(r.name).toBe("Nilesh");
    expect(r.email).toBe("test@example.com");
  });
  it("rejects short, long and mismatched passwords", () => {
    expect(registerSchema.safeParse({ ...valid, password: "short", confirmPassword: "short" }).success).toBe(false);
    const long = "x".repeat(129);
    expect(registerSchema.safeParse({ ...valid, password: long, confirmPassword: long }).success).toBe(false);
    const r = registerSchema.safeParse({ ...valid, confirmPassword: "different-password" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["confirmPassword"]);
  });
  it("rejects invalid email and unknown weight units", () => {
    expect(registerSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, weightUnit: "STONE" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires email and password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
});

describe("isValidTimezone", () => {
  it("accepts IANA zones and rejects junk", () => {
    expect(isValidTimezone("Asia/Kolkata")).toBe(true);
    expect(isValidTimezone("America/Los_Angeles")).toBe(true);
    expect(isValidTimezone("Mars/Olympus")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
    expect(isValidTimezone(42)).toBe(false);
    expect(isValidTimezone("x".repeat(100))).toBe(false);
  });
});
