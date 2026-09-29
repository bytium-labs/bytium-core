export function isCustomProvider(provider: unknown): provider is {
  provide: string;
  useFactory?: unknown;
  useValue?: unknown;
  useClass?: unknown;
  useExisting?: unknown;
} {
  return (
    provider !== null &&
    typeof provider === "object" &&
    "provide" in provider &&
    ("useFactory" in provider || "useValue" in provider || "useClass" in provider || "useExisting" in provider)
  );
}
