import "server-only";

import { db } from "./client.js";

/**
 * Deterministic seed data.
 *
 * Two things depend on this file, so it is not optional decoration:
 *
 * 1. The MVP review. Forty screens against empty tables tell you nothing about
 *    whether the product feels right. You cannot judge a booking list with no
 *    bookings in it.
 * 2. `before-and-after`. It compares two deployments. If the data differs
 *    between them, every screenshot pair reads as a change and the diff is
 *    noise.
 *
 * ## Rules
 *
 * - **Fixed ids.** Write them out. No `uuid()`, no auto-increment you did not
 *   choose, nothing seeded from `Math.random()`.
 * - **Frozen dates.** Anchor everything to `SEED_NOW`. A receipt rendering
 *   today's date differs between two captures taken ten minutes apart.
 * - **No faker.** Random names re-roll on every run and break the pairing.
 * - **Idempotent.** Running twice leaves the same rows. Upsert on the fixed id.
 * - **Domain vocabulary.** Names come from `docs/product/ontology.md`, not from
 *   convenience. See that file's Vocabulary section.
 * - **Invented people only.** Never seed a real person's record — the salvage
 *   inbox holds photographs of registers with real names, and none of them
 *   belong here.
 *
 * ## Seat users
 *
 * `SEED_USERS` maps a seat name to the Clerk user id that wears it. The
 * preview-login route (`apps/web/src/app/api/preview-login/route.ts`) reads it
 * so a screenshot run can reach an authenticated screen by URL. Add one entry
 * per seat in the journey spine.
 */

/** Anchor for every date in the seed. Never `new Date()`. */
export const SEED_NOW = new Date("2026-01-15T09:00:00.000Z");

/** Offset from the anchor, so relative dates stay stable across runs. */
export function seedDate(daysFromAnchor: number): Date {
  return new Date(SEED_NOW.getTime() + daysFromAnchor * 86_400_000);
}

/** Seat name -> Clerk user id. Populated once the product has seats. */
export const SEED_USERS: Record<string, string> = {};

export async function seed(): Promise<void> {
  // Tables land in wave 0, before any feature ticket. Insert them here in
  // dependency order, upserting on the fixed id so a re-run is a no-op.
  //
  //   await db.insert(devotees).values(DEVOTEES)
  //     .onConflictDoUpdate({ target: devotees.id, set: { ... } });
  void db;
}
