import { randomUUID } from "node:crypto";
import type { State } from "./store.js";

export type Snapshot = { state: State; sha?: string };
export type Store = {
  read(): Promise<Snapshot>;
  save(state: State, previous?: string): Promise<string>;
};
// Must exceed the Vercel invocation's configured 60s maximum. A fresh owner
// may claim after 5 minutes; an old invocation must not survive that window.
export const LEASE_MS = 300_000;
export async function claim(store: Store, now = Date.now()) {
  const snapshot = await store.read();
  if (snapshot.state.lease && snapshot.state.lease.until > now) return null;
  const owner = randomUUID();
  snapshot.state.lease = { owner, until: now + LEASE_MS };
  const sha = await store.save(snapshot.state, snapshot.sha);
  return { ...snapshot, sha, owner };
}
export async function assertLease(store: Store, owner: string, now = Date.now()) {
  const { state } = await store.read();
  if (state.lease?.owner !== owner || state.lease.until <= now)
    throw new Error("Factory lease lost; no side effect permitted");
}
