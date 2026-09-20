import { expect, test } from "bun:test";
import { assertLease, claim, type Store } from "../agent/lib/lease.js";
import type { State } from "../agent/lib/store.js";

function memoryStore(): Store {
  let state: State = { version: 1 };
  let revision = "0";
  return {
    async read() {
      return { state: structuredClone(state), sha: revision };
    },
    async save(next, previous) {
      if (previous !== revision) throw new Error("CAS conflict");
      state = structuredClone(next);
      revision = String(Number(revision) + 1);
      return revision;
    },
  };
}
test("simultaneous invocations cannot both acquire a dispatch lease", async () => {
  const store = memoryStore();
  const results = await Promise.allSettled([claim(store, 0), claim(store, 0)]);
  expect(results.filter((r) => r.status === "fulfilled" && r.value !== null)).toHaveLength(1);
});
test("crash lease expires and stale owner is fenced out", async () => {
  const store = memoryStore();
  const first = await claim(store, 0);
  expect(await claim(store, 100)).toBeNull();
  const second = await claim(store, 300001);
  expect(second).not.toBeNull();
  await expect(assertLease(store, first!.owner, 300002)).rejects.toThrow();
  await assertLease(store, second!.owner, 300002);
});
test("expired owner cannot dispatch even without another owner", async () => {
  const store = memoryStore();
  const first = await claim(store, 0);
  await expect(assertLease(store, first!.owner, 300000)).rejects.toThrow();
});
