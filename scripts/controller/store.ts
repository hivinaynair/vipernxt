import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { hash } from "../factory/core";
export type Batch = {
  revision?: number;
  id: string;
  repository: string;
  commit: string;
  manifest: string;
  issueId: string;
  teamId: string;
  jobIssues: Record<string, string>;
  snapshots: Record<string, string>;
  root: string;
  requested: string;
  observed?: string;
  sessions: string[];
  error?: string;
};
export class Store {
  db: Database;
  constructor(path: string) {
    this.db = new Database(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS batches(id TEXT PRIMARY KEY, issue TEXT NOT NULL, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS inbox(id TEXT PRIMARY KEY, body TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY, body TEXT NOT NULL, tries INTEGER NOT NULL DEFAULT 0, next INTEGER NOT NULL DEFAULT 0, done INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY, digest TEXT NOT NULL, batch TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS commands(id TEXT PRIMARY KEY);
    `);
  }
  batches(): Batch[] {
    return this.db
      .query<{ body: string }, []>("SELECT body FROM batches ORDER BY rowid")
      .all()
      .map((r) => JSON.parse(r.body));
  }
  get(id: string) {
    return this.batches().find((b) => b.id === id);
  }
  save(b: Batch) {
    this.transaction(() => {
      const current = this.get(b.id);
      if (current && current.revision !== b.revision)
        throw new Error("Batch changed concurrently; retry from current state");
      b.revision = (b.revision ?? 0) + 1;
      this.db.run(
        "INSERT INTO batches VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
        [b.id, b.issueId, JSON.stringify(b)],
      );
    });
  }
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }
  submit(key: string, input: unknown, batch: Batch) {
    return this.transaction(() => {
      const prior = this.db
        .query<{ digest: string; batch: string }, [string]>(
          "SELECT digest,batch FROM submissions WHERE id=?",
        )
        .get(key);
      if (prior) {
        if (prior.digest !== hash(input))
          throw new Error("Submission key reused with different scope");
        return prior.batch;
      }
      if (this.get(batch.id)) throw new Error("Batch ID already registered");
      if (this.batches().some((b) => b.issueId === batch.issueId && b.requested !== "finished"))
        throw new Error("Issue already has an unfinished batch");
      this.save(batch);
      this.db.run("INSERT INTO submissions VALUES(?,?,?)", [key, hash(input), batch.id]);
      return batch.id;
    });
  }
  receive(id: string, body: unknown) {
    this.db.run("INSERT OR IGNORE INTO inbox(id,body) VALUES(?,?)", [id, JSON.stringify(body)]);
  }
  pending() {
    return this.db
      .query<{ id: string; body: string }, []>(
        "SELECT id,body FROM inbox WHERE done=0 ORDER BY rowid LIMIT 20",
      )
      .all();
  }
  enqueue(body: unknown) {
    this.db.run("INSERT INTO outbox(id,body) VALUES(?,?)", [randomUUID(), JSON.stringify(body)]);
  }
  close() {
    this.db.close();
  }
}
