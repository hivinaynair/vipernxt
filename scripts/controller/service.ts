import { execFile, spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { alive, hash, type Ledger, type Manifest, read, safePath, validate } from "../factory/core";
import { issueHash, type Linear } from "./linear";
import { type Action, type AgentEvent, equalSecret, eventCommand, verifyWebhook } from "./protocol";
import { type Batch, Store } from "./store";

const exec = promisify(execFile);
export type Config = {
  appUserId?: string;
  mentionUrl?: string;
  data: string;
  token: string;
  webhookSecret: string;
  clientId: string;
  workspace: string;
  users: string[];
  teams: Record<
    string,
    { repository: string; states: { running: string; review: string; canceled: string } }
  >;
};
export class Controller {
  store: Store;
  busy = false;
  pumping = false;
  registration = false;
  children = new Map<string, ReturnType<typeof spawn>>();
  constructor(
    public config: Config,
    public linear: Linear,
    public baseUrl: string,
  ) {
    mkdirSync(config.data, { recursive: true, mode: 0o700 });
    this.store = new Store(join(config.data, "controller.sqlite"));
  }
  async register(
    input: {
      repository: string;
      commit: string;
      manifest: string;
      issueId: string;
      teamId: string;
      jobIssues: Record<string, string>;
    },
    key: string,
  ) {
    if (this.registration) throw new Error("Another registration is in progress; retry");
    this.registration = true;
    try {
      const prior = this.store.db
        .query<{ digest: string; batch: string }, [string]>(
          "SELECT digest,batch FROM submissions WHERE id=?",
        )
        .get(key);
      if (prior) {
        if (prior.digest !== hash(input)) throw new Error("Submission key reused");
        return prior.batch;
      }
      if (
        this.config.teams[input.teamId]?.repository !== input.repository ||
        !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(input.repository) ||
        !/^[a-f0-9]{40}$/.test(input.commit) ||
        !safePath(input.manifest)
      )
        throw new Error("Repository/team/commit/manifest is not permitted");
      const root = join(
        this.config.data,
        "repos",
        hash({ repository: input.repository, commit: input.commit, manifest: input.manifest }),
      );
      mkdirSync(root, { recursive: true });
      const git = async (...args: string[]) =>
        exec("git", ["-c", "core.hooksPath=/dev/null", ...args], {
          cwd: root,
          timeout: 60000,
          maxBuffer: 1024 * 1024,
        });
      if (!existsSync(join(root, ".git"))) await git("init");
      await git("fetch", "--no-tags", `https://github.com/${input.repository}.git`, input.commit);
      await git("checkout", "--detach", input.commit);
      const m = read<Manifest>(join(root, input.manifest));
      if (
        m.worker.kind !== "cursor" ||
        m.verification !== "cursor-cloud" ||
        m.delivery ||
        m.worker.repository !== `https://github.com/${input.repository}` ||
        m.worker.gitTransport === "ssh"
      )
        throw new Error(
          "Hosted v1 requires Cursor remote verification, HTTPS Git and no delivery commands",
        );
      validate(root, m);
      const jobs = Object.keys(input.jobIssues);
      if (
        jobs.length !== m.jobs.length ||
        m.jobs.some((j) => !input.jobIssues[j.id]) ||
        new Set(Object.values(input.jobIssues)).size !== jobs.length
      )
        throw new Error("Every job needs one distinct Linear issue");
      const snapshots: Record<string, string> = {};
      for (const id of new Set([input.issueId, ...Object.values(input.jobIssues)])) {
        const issue = await this.linear.issue(id);
        if (
          issue.team.id !== input.teamId ||
          issue.archivedAt ||
          ["canceled", "completed"].includes(issue.state.type)
        )
          throw new Error("Issue is unavailable or already terminal");
        if (id !== input.issueId && issue.parent?.id !== input.issueId)
          throw new Error("Batch jobs must be direct children of the batch issue");
        snapshots[id] = issueHash(issue);
      }
      return this.store.submit(key, input, {
        ...input,
        id: m.id,
        root,
        snapshots,
        requested: "ready",
        sessions: [],
      });
    } finally {
      this.registration = false;
    }
  }
  ledger(b: Batch): Ledger | undefined {
    const p = join(b.root, ".factory", b.id, "ledger.json");
    return existsSync(p) ? read<Ledger>(p) : undefined;
  }
  async fresh(b: Batch) {
    for (const [id, snapshot] of Object.entries(b.snapshots)) {
      const issue = await this.linear.issue(id);
      if (issue.archivedAt || issue.state.type === "canceled" || issueHash(issue) !== snapshot)
        throw new Error("Ticket scope changed or was withdrawn; prepare a revised batch");
    }
  }
  execute(b: Batch, action: Action) {
    if (action === "status") return;
    const state = this.ledger(b);
    const terminal = ["completed-local", "awaiting-review", "delivered", "cancelled"];
    if (terminal.includes(state?.status ?? ""))
      throw new Error("Batch has finished; register a new approved batch");
    if (action === "build") {
      if (!["ready", "queued", "running"].includes(b.requested))
        throw new Error("Use resume for paused work or retry for failed work");
      if (state && ["blocked", "failed"].includes(state.status))
        throw new Error("Execution needs attention; inspect status before resuming");
      b.requested = "queued";
    } else if (action === "pause") {
      b.requested = "paused";
    } else if (action === "cancel") {
      b.requested = "cancelled";
    } else if (action === "resume") {
      if (b.requested !== "paused" && state?.status !== "blocked")
        throw new Error("Resume requires paused or blocked work");
      b.requested = "resume";
    } else {
      if (!state || !["failed", "blocked"].includes(state.status))
        throw new Error("Retry requires failed work");
      const m = read<Manifest>(join(b.root, b.manifest));
      if (
        !Object.values(state.jobs).some(
          (j) => j.status === "failed" && j.attempts.length < m.limits.attempts,
        )
      )
        throw new Error(
          "No remaining safe retry; reconcile the blocked run or approve a new batch",
        );
      b.requested = "retry";
    }
    this.store.save(b);
  }
  summary(b: Batch) {
    const s = this.ledger(b);
    const jobs = s
      ? Object.entries(s.jobs)
          .map(([id, j]) => `${id}: ${j.status} (${j.attempts.length} attempts)`)
          .join("\n")
      : "No workers dispatched.";
    const links: string[] = [];
    for (const job of Object.values(s?.jobs ?? {}))
      for (const a of job.attempts) {
        for (const name of ["cursor.json", "cursor-review/cursor.json"]) {
          const p = join(a.dir, name);
          if (existsSync(p)) {
            const r = read<{ agentId: string }>(p);
            links.push(`https://cursor.com/agents/${r.agentId}`);
          }
        }
      }
    return `${b.id}: ${b.error ? "needs attention" : (s?.status ?? b.requested)}\n${jobs}${b.error || s?.error ? `\n${b.error ?? s?.error}` : ""}${links.length ? `\n${links.join("\n")}` : ""}${s?.integration ? `\nCandidate: ${s.integration}` : ""}`;
  }
  async inbox() {
    for (const row of this.store.pending()) {
      const event = JSON.parse(row.body) as AgentEvent;
      const session = event.agentSession.id;
      const issue = event.agentSession.issueId ?? event.agentSession.issue?.id;
      const user =
        event.action === "prompted" ? event.agentActivity?.userId : event.agentSession.creatorId;
      const eventId = event.agentActivity?.id ?? `${session}:created`;
      if (!user || !this.config.users.includes(user)) {
        this.store.db.run("UPDATE inbox SET done=1 WHERE id=?", [row.id]);
        continue;
      }
      // Fetch only the triggering comment, never promptContext (which contains ticket prose).
      let comment: string | undefined;
      if (event.action === "created" && event.agentSession.sourceCommentId)
        comment = await this.linear.comment(event.agentSession.sourceCommentId);
      const action = eventCommand(event, comment, this.config.mentionUrl);
      this.store.transaction(() => {
        if (!this.store.db.query("SELECT id FROM commands WHERE id=?").get(eventId)) {
          let body: string;
          const b = this.store
            .batches()
            .filter((b) => b.issueId === issue)
            .at(-1);
          try {
            if (!action)
              throw new Error(
                "Commands: build, status, pause, resume, cancel, retry. Use one command only.",
              );
            if (!b)
              throw new Error(
                "This ticket has no registered approved scope. Prepare it with /next first. For a batch child, mention the parent batch to control execution.",
              );
            if (!b.sessions.includes(session)) b.sessions.push(session);
            this.execute(b, action);
            this.store.save(b);
            body = this.summary(b);
          } catch (error) {
            body = (error as Error).message;
          }
          this.store.enqueue({ session, body });
          this.store.db.run("INSERT INTO commands VALUES(?)", [eventId]);
        }
        this.store.db.run("UPDATE inbox SET done=1 WHERE id=?", [row.id]);
      });
    }
  }
  async outbox() {
    const rows = this.store.db
      .query<{ id: string; body: string; tries: number }, [number]>(
        "SELECT id,body,tries FROM outbox WHERE done=0 AND next<=? ORDER BY rowid LIMIT 10",
      )
      .all(Date.now());
    for (const row of rows) {
      const item = JSON.parse(row.body);
      try {
        if (item.session)
          await this.linear.activity(row.id, item.session, item.body, item.type ?? "response");
        else {
          // A stale status update must never overwrite a newer state or human cancellation.
          const b = this.store.get(item.batch);
          const s = b ? this.ledger(b) : undefined;
          if (
            b &&
            s &&
            s.jobs[item.job]?.status === item.expected &&
            (await this.linear.issue(item.issue)).state.type !== "canceled"
          )
            await this.linear.state(item.issue, item.state);
        }
        this.store.db.run("UPDATE outbox SET done=1 WHERE id=?", [row.id]);
      } catch {
        this.store.db.run("UPDATE outbox SET tries=tries+1,next=? WHERE id=?", [
          Date.now() + Math.min(300000, 1000 * 2 ** Math.min(row.tries, 8)),
          row.id,
        ]);
        break;
      }
    }
  }
  async pump() {
    if (this.pumping) return;
    this.pumping = true;
    try {
      await this.inbox();
      await this.outbox();
    } finally {
      this.pumping = false;
    }
  }
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      let active = this.store.batches().some((b) => {
        const lock = join(b.root, ".factory", b.id, "supervisor.json");
        return (
          this.children.has(b.id) || (existsSync(lock) && alive(read<{ pid: number }>(lock).pid))
        );
      });
      for (const b of this.store.batches()) {
        const dir = join(b.root, ".factory", b.id);
        mkdirSync(dir, { recursive: true });
        if (b.requested === "paused") writeFileSync(join(dir, "pause"), "");
        if (b.requested === "cancelled") writeFileSync(join(dir, "cancel"), "");
        const s = this.ledger(b);
        if (
          s &&
          ["completed-local", "awaiting-review", "delivered", "cancelled"].includes(s.status)
        )
          b.requested = "finished";
        const observation = s
          ? hash({ status: s.status, jobs: s.jobs, integration: s.integration })
          : b.requested;
        if (b.observed !== observation) {
          b.observed = observation;
          for (const session of b.sessions)
            this.store.enqueue({
              session,
              body: this.summary(b),
              type: s && ["running", "pausing"].includes(s.status) ? "thought" : "response",
            });
          if (s)
            for (const [job, j] of Object.entries(s.jobs)) {
              const states = this.config.teams[b.teamId].states;
              const state =
                j.status === "running"
                  ? states.running
                  : j.status === "accepted"
                    ? states.review
                    : undefined;
              if (state)
                this.store.enqueue({
                  batch: b.id,
                  job,
                  expected: j.status,
                  issue: b.jobIssues[job],
                  state,
                });
            }
          this.store.save(b);
        }
        const lock = join(dir, "supervisor.json");
        if (existsSync(lock) && alive(read<{ pid: number }>(lock).pid)) {
          active = true;
          continue;
        }
        if (this.children.has(b.id)) {
          active = true;
          continue;
        }
        if (
          active ||
          b.requested === "ready" ||
          (b.requested === "paused" && (!s || s.status === "paused")) ||
          (!s && b.requested === "cancelled")
        )
          continue;
        if (
          s &&
          [
            "completed-local",
            "awaiting-review",
            "delivered",
            "cancelled",
            "failed",
            "blocked",
          ].includes(s.status) &&
          !["resume", "retry"].includes(b.requested)
        )
          continue;
        if (b.requested !== "cancelled") {
          try {
            await this.fresh(b);
            delete b.error;
          } catch {
            b.error = "Linear unavailable or scope changed. New execution is held.";
            this.store.save(b);
            continue;
          }
        }
        const action = ["resume", "retry"].includes(b.requested) ? b.requested : "run";
        // Persist desired state before launch. Runtime claims and remote IDs fence retries.
        b.requested = b.requested === "cancelled" ? "cancelled" : "running";
        this.store.save(b);
        const fd = openSync(join(dir, "supervisor.log"), "a", 0o600);
        const child = spawn(
          process.execPath,
          [resolve(import.meta.dir, "../factory.ts"), action, join(b.root, b.manifest)],
          {
            cwd: b.root,
            stdio: ["ignore", fd, fd],
            env: {
              ...process.env,
              FACTORY_CONTROL_URL: this.baseUrl,
              FACTORY_CONTROL_TOKEN: this.config.token,
            },
          },
        );
        closeSync(fd);
        this.children.set(b.id, child);
        active = true;
        child.once("exit", () => this.children.delete(b.id));
        child.once("error", () => this.children.delete(b.id));
      }
    } finally {
      this.busy = false;
    }
  }
  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/healthz") return Response.json({ ok: true });
    if (request.method === "POST" && url.pathname === "/webhooks/linear") {
      const raw = await request.text();
      if (
        !verifyWebhook(
          raw,
          request.headers.get("linear-signature") ?? "",
          this.config.webhookSecret,
        )
      )
        return new Response("Invalid signature", { status: 401 });
      const e = JSON.parse(raw) as AgentEvent;
      if (
        e.organizationId !== this.config.workspace ||
        e.oauthClientId !== this.config.clientId ||
        (this.config.appUserId && e.appUserId !== this.config.appUserId)
      )
        return new Response("Wrong installation", { status: 403 });
      if (e.type !== "AgentSessionEvent" || !["created", "prompted"].includes(e.action))
        return new Response("Ignored");
      if (!e.agentSession?.id) return new Response("Missing session", { status: 400 });
      const id = request.headers.get("linear-delivery");
      if (!id) return new Response("Missing delivery ID", { status: 400 });
      this.store.receive(id, e);
      return new Response("Accepted", { status: 202 });
    }
    if (!equalSecret(request.headers.get("authorization") ?? "", `Bearer ${this.config.token}`))
      return new Response("Unauthorized", { status: 401 });
    try {
      if (request.method === "POST" && url.pathname === "/v1/batches") {
        const key = request.headers.get("idempotency-key");
        if (!key || key.length > 200) throw new Error("Idempotency-Key required");
        return Response.json(
          { id: await this.register(await request.json(), key) },
          { status: 201 },
        );
      }
      if (request.method === "POST" && url.pathname === "/internal/gate") {
        const { id, job, stage } = (await request.json()) as {
          id: string;
          job: string;
          stage: string;
        };
        if (!["dispatch", "integrate"].includes(stage)) throw new Error("Unknown gate stage");
        const b = this.store.get(id);
        if (
          !b?.jobIssues[job] ||
          b.requested === "cancelled" ||
          (stage === "dispatch" && b.requested === "paused")
        )
          throw new Error("Dispatch not authorized");
        await this.fresh(b);
        const current = this.store.get(id);
        if (!current || current.revision !== b.revision)
          throw new Error("Batch changed during authorization; execution held");
        return new Response("Approved");
      }
      const match = url.pathname.match(
        /^\/v1\/batches\/([a-z0-9-]+)(?:\/(pause|resume|cancel|retry|build))?$/,
      );
      if (match) {
        const b = this.store.get(match[1]);
        if (!b) return new Response("Not found", { status: 404 });
        if (request.method === "GET" && !match[2])
          return Response.json({ id: b.id, status: this.summary(b) });
        if (request.method === "POST" && match[2]) {
          this.execute(b, match[2] as Action);
          return Response.json({ id: b.id, status: this.summary(b) });
        }
      }
      return new Response("Not found", { status: 404 });
    } catch (error) {
      return Response.json({ error: (error as Error).message }, { status: 409 });
    }
  }
}
