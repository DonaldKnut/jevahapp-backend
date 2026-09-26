/** Telemetry only — never a privilege or role. */
export function normalizeSignupSource(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!value) return undefined;
  return value.slice(0, 40);
}

export function isCreatorWebSource(source?: string | null): boolean {
  return source === "creators_web";
}
