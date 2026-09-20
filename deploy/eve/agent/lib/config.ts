export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
export function repository(): string {
  const repo = required("FACTORY_REPO");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error("Invalid FACTORY_REPO");
  return repo;
}
/** Dispatch is gated by a trusted factory label and a valid catalog, not a deploy switch. */
export function enabled() {
  return true;
}
