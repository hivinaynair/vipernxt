# ViperNxt

**Sit with a site. Leave with a clip that moves a number — then a factory.**

## What this does for you

You have a customer with a problem, and you are about to build them software.
This repo is the procedure for that first week — written so an agent can run
most of it — plus the stack it builds on.

Clone it, type `/next`, name the site and what they use today. It stops for you
four times. Everything else it does alone.

**What it is best at is stopping you building the wrong thing.** Before it
designs anything it reads whatever the job runs on today and prices the
incumbent, because the most expensive week is the one spent rebuilding a feature
your customer already pays for.

<details>
<summary>A worked example — one engagement, start to first screen</summary>

A test run of this kit, against an invented but realistic customer: a compliance
manager at a fintech, drowning in a SOC 2 audit. The obvious build was a tracker
for the auditor's request list.

- **Phase 0 killed that idea.** Salvage checked the incumbent before designing
  anything: the customer already paid $27k/yr for Vanta, and Vanta ships that
  tracker. So do Drata and Secureframe. Building it would have been a week spent
  rebuilding something already bought.
- **What survived was smaller and real.** Of their last ten evidence requests,
  six came back from the auditor, and four of those six for the same reason: the
  file was right but described the wrong *period*. Nobody checked before sending.
- **The clip became a pre-flight check** — not a tracker. One screen that reads a
  file and says "this describes September; they asked for June, ending 06-30",
  and names the rows that disagree.
- **Scored, not asserted.** Replaying their ten real cases: 4 of 10 handled, 6
  explicitly out of the first slice with reasons. That number is what you show
  them — not "it works".

The point is the first bullet. Nothing in the interview would have surfaced it;
the customer asked for the tracker.

</details>

## What you have, and when

| After | You have |
|---|---|
| an hour | their pile read and cited, the incumbent named and priced, and a short list of what only they can tell you |
| a day or two | one paragraph you confirmed: the outcome number, whose pain it is, and why the obvious build is wrong |
| a day after that | a named clone, a composed stack, the domain model in their vocabulary, and an ID'd journey spine |
| the end of the week | one journey working on real seeded data **on your laptop**, scored against their last ten real cases |
| after you accept it | infrastructure, tickets, and parallel slices |

Nothing before the last row needs a GitHub repo, a Neon account, a Vercel
project, or a credit card. The first slice runs on a local database the kit
starts for you.

## What it will not do

- **Turn an idea into an MVP over a weekend.** Product UI is locked by a hook
  until you confirm the reframe. That is the point, not a bug.
- **Decide what the product is.** It drafts; you confirm. Four hard stops.
- **Let you pick a stack per customer.** Change
  [docs/kit/recipe.yaml](docs/kit/recipe.yaml) once; clones compose from it.
- **Ship auth on day one.** Seats and login wait until after you accept the clip,
  alongside the rest of the infrastructure.

---

## How it is built

Two things in one repository:

1. **An FDE playbook** — agent skills that run the engagement: salvage the pile,
   watch the work, reframe the request, seed an eval set, ship one slice, then
   (only then) the factory.
2. **A stack recipe** — [docs/kit/recipe.yaml](docs/kit/recipe.yaml). After U5,
   compose scaffolds Next.js within pinned majors and applies kit overlays
   (feature folders, `@/env`, shadcn in `packages/ui`, Drizzle + Neon). There is
   no second template repo to clone and strip.

Procedure: [docs/playbook/fde-loop.md](docs/playbook/fde-loop.md).

**Requires** [Bun](https://bun.sh) `1.4.x`. Anything else fails on install.

---

## Who this is for

- You are embedding with a real site (or about to), and you want the loop
  written down so an agent can run it.
- You are one person, or a very small team, shipping a real product after the
  clip.
- You are happy to let agents write most of the code, as long as you can see
  what they did.
- You want the boring stack decisions already made.

## Who this is not for

- You want a demo app to restyle. There is no app in this kit until compose.
- You want to pick a new stack per site. Change [docs/kit/recipe.yaml](docs/kit/recipe.yaml)
  in this kit; clones compose from it. A site does not invent Prisma or NextAuth.
- You want to start coding immediately. Until the design doc is approved **and**
  the U5 reframe exists, a hook physically blocks writes to product UI. This is
  the point, not a bug.
- You use npm, pnpm, yarn, ESLint, Vitest, Prisma, or NextAuth. Those arguments
  are closed here.

---

## The whole flow

```
   a site + what they use today
      │
      ▼
  ┌─────────┐
  │ /next   │◄──────── you type this, and only this
  └────┬────┘
       │
       ▼
  U  understand   salvage the pile · incumbent gate · watch the work
                  last 10 cases become the eval set
       │
       ▼  ✋ they confirm the reframe (U5). no product UI before this.
       │
  R  reframe      the design-doc claim *is* that paragraph
  P  probe        optional: replay the eval set, count the baseline
                  (not product UI)
  C  clip         compose from the recipe → ontology + spine → wave 0
                  seeds the eval set → one journey, working
                  on a local database. no accounts, no keys, no spend.
       │
       ▼  ✋ YOU LOOK AT IT, and at its score against the ten real cases.
       │     the only mandatory stop in the build.
       │
  F  factory      setup, Linear, parallel slices — only after they accept
       │
       ▼
     you review   feel the MVP, comment on PRs, say what's wrong
     release      staging → main
```

Four stops. Everything between them runs without you.

Live engagements belong on a **throwaway clone**. Do not commit a site, a pile,
or `docs/product/state.yaml` into this kit. Learnings that generalize come back
as playbook.

---

## Getting started

```bash
bun install
```

Then type `/next`. Name the site and what they use today. Drop the pile.

That is genuinely the whole instruction. `/next` figures out where you are and
what happens next, every time. You never need to remember which skill to run.

---

## When it stops for you

Everything here is designed so the agent decides as much as it possibly can on
its own. The rule it follows is:

> Never stop for something it could have found out itself.

So it reads your repo, reads the docs, searches the web, and follows claims to
the source. What is left over is genuinely yours, and it comes in two kinds:

- **Gather** — facts that exist only in the real world. A photograph, a filled-in
  form, what the clerk actually does on a Tuesday. No amount of research
  substitutes for these. The digest splits **Waiting on you** vs **Waiting on
  the site**.
- **Decide** — a call only you can make.

There are four of these, and every one is a hard stop.

### 1. Your pile — *gather*

Before it invents anything, `salvage` reads what already exists. It asks you for
it with a checklist and **will not start on a half-empty folder**. It also
checks the incumbent: name, vendor, price, whether every transaction already
goes through it, and what the paid version already does. Recommending they
upgrade instead of building is a valid outcome.

See [Where to put your stuff](#where-to-put-your-stuff) below.

### 2. The homework — *gather*

`field-kit` writes you a form: who to talk to, what to ask, what to photograph,
what to bring back. It renders as a `.docx` you can type into on site. If they
are about to change the system of record, the first page is **baseline numbers
this week** — after an upgrade those numbers mix forever.

This one is a genuine blocker. The agent can research a domain all day and still
not know that the counter clerk keeps a handwritten code sheet taped to the
monitor because the software cannot do refunds. Until you go and look, the
product is being designed from guesses — so it waits.

While you are out, it keeps researching anything that does not depend on you. It
does not idle.

### 3. Approving the reframe / design doc — *decide*

Before this, the agent has watched (or absorbed the pile), named an outcome
number, and written **why the obvious build is wrong**. You confirm that
paragraph. That *is* the design-doc claim.

Until you say yes, **writes to `apps/*/src/app` and `apps/*/src/features` are
denied by a hook.** Not discouraged — denied. This exists because the fastest
way to build the wrong product is to start building it before anyone has said
what it is.

### 4. Looking at the first slice — *decide*

Before the factory builds forty tickets, it builds **one journey, end to end,
through the eval set**. Then it stops and shows you.

Half an hour of your attention here is worth days later. If the domain model is
wrong — and it usually is wrong in one place — you find out after one ticket
instead of after forty.

---

## Where to put your stuff

You will be asked for real-world material twice. There is a folder for each, and
a script that makes what you drop in actually readable by an agent.

### Anything that already exists → `docs/research/salvage-inbox/`

Scribbled notes, a spreadsheet, screenshots of the old software, photographs of a
register, a wireframe you drew last month, an exported CSV, an email thread.

**Do not rename anything. Any format is fine.**

**This machine:** drop the files in `docs/research/salvage-inbox/`, then:

```bash
bun scripts/salvage-inbox.mjs docs/research/salvage-inbox
```

**Cloud:** a Cloud Agent cannot see that folder. Prefer they run the command above
on a laptop and send only `INVENTORY.md` plus the `.transcript.md` files. If the
originals have to travel, attach **one zip** of the folder — not forty photos in
the thread, not a Drive link, not the VM desktop.

That copies originals to `raw/`, writes readable JPEGs to `pages/`, and
generates an `INVENTORY.md` with a line per page for you to caption. It exists
because an iPhone photo is HEIC — which an agent cannot open at all — and a 4K
screenshot is too large to read. If the text comes out sideways, re-run with
`--rotate 90`; photos of screens and walls usually are.

What is worth digging out:

| Bring | Why |
|---|---|
| A **filled-in** form or receipt — not a blank one | Blank gives you field names. Filled gives you which fields everyone leaves empty, and what gets written in the margin |
| The spreadsheet as **CSV**, not a screenshot of it | A screenshot of a spreadsheet is the worst of both |
| Screenshots of the old software — including the ugly screens | Vocabulary, dropdown states, error text |
| Anything **taped to a wall** or clipped to the counter, and anything laminated | This is where the workarounds live. A handwritten code sheet stuck to a monitor is staff telling you exactly where the software fails them |
| Anything printed that gets handed to a customer | Legal requirements nobody thinks to mention |
| The last ten real cases (or a week of the job) | This becomes the eval set. Wave 0 seeds it |

Saying "we don't have that" is a real answer — the absence is itself a finding.
Say it rather than leaving a blank.

> `raw/` and the page JPEGs are gitignored. Photographs of a register hold real
> names, and they are not going into version control — especially not from a
> cloud agent PR.

### What comes back from the field → `docs/product/intake/`

`field-kit` writes your homework to `docs/product/homework/` and renders it as a
Word document you can actually type into on site:

```bash
bun scripts/homework.mjs build docs/product/homework/02-site-visit.md
```

Fill it in, drop the filled copy into `docs/product/intake/`, and it gets read
back:

```bash
bun scripts/homework.mjs read docs/product/intake/02-site-visit.docx
```

Formatting is not your job — messy is fine. Photographs you took while you were
there go through `salvage-inbox.mjs` first, same as everything else.

---

## The skills

Skills live in [`.agents/skills/`](.agents/skills/). Claude Code and Cursor both
see them through symlinks.

**You type `/next`. You do not type the others.** They are listed so you know
what is happening, not so you can drive them manually.

| Skill | What it does | When |
|---|---|---|
| `next` | The router. Works out what happens now and does it. | You type this |
| `status` | A read-only glance: where things stand, what you owe. | You type this |
| `eval` | Not a skill — `bun scripts/eval.ts`. Scores a slice against the last ten real cases. | At the checkpoint |
| `salvage` | Mines prior art for facts — old repos, spreadsheets, photographs of forms. | Phase 0 |
| `field-kit` | Writes your homework, then absorbs what you bring back. | Phase 2 |
| `shape` | The interview. One question at a time → the design doc. | Phase 3 |
| `ontology` | Names the domain's entities and states in the domain's own words. | Phase 3.5 |
| `journeys` | Turns the design doc's journey table into the ID'd spine. | Phase 4 |
| `design-system` | Layout primitives and semantic tokens, before any page exists. | Phase 5 |
| `linear-sync` | Publishes the spine to Linear as tickets carrying step IDs. | Phase 4.5 |
| `customize` | Names your clone, composes surfaces from the recipe. | After shape |
| `setup` | Runs `setup.sh` — GitHub, Neon, Vercel, Clerk, Linear. | After they accept the clip |
| `plan` | One feature → a short spec and the smallest buildable slices. | Phase 6 |
| `build` | Implements one slice: isolate, build, prove, ship. | Phase 6 |
| `prototype` | Three real variants of one component, behind a picker. | Mid-build |
| `artifacts` | House rules for every document the playbook writes. | Always |
| `before-and-after` | Before/after screenshots for a PR. | Mid-build |
| `next-dev-loop` | Verifies a change actually runs in the browser. | Mid-build |

### The two you *will* reach for

**`/next`** — every time. New idea, resuming after a week, answering a question,
saying the journey is wrong, naming a feature to build. All of it is `/next`.

**`prototype`** — when a screen exists and something about it feels off but you
cannot say what. It builds three genuinely different versions of that one
component behind a picker, and you decide by looking instead of arguing.

---

## How the factory builds

After you approve the first slice, the rest is built in **waves**.

**Wave 0 is schema and seed data.** Every table the ontology names lands first,
before any feature ticket starts. This is what makes parallel building safe: if
all the migrations are already done, no two agents can fight over the database.

Seed data ships with it — the **anonymized eval set**, fixed ids, frozen dates. This matters
more than it sounds. Forty screens with empty tables tell you nothing about
whether the product feels right.

**Then feature waves, up to five agents at once.** Features live in
`src/features/<slug>/` and are forbidden from importing each other, so two
agents in different folders physically cannot collide. Anything touching shared
ground — routes, `shared/`, packages, the schema — runs alone.

**Every slice becomes one PR into `staging`**, carrying:

- tests named after the journey steps they satisfy
- screenshots and traces proving it works
- the step IDs in the PR body

Your bug board (Cursor Bugbot, Codex, whichever you configured) reviews it and
can push fixes. Auto-merge waits for green *after* the last push.

**When something looks wrong, comment on the PR.** The agent triages what you
said:

| You said | What happens |
|---|---|
| "this is a bug" | Fixed in that PR |
| "this feels wrong" | `prototype` — three variants, you pick |
| "this whole flow is wrong" | PR closes, `/next` reopens the journey spine |

That last row matters. Journey-level feedback goes back to the spine, never
absorbed quietly into a diff — otherwise the code and the plan drift apart and
everything built afterwards inherits the drift.

---

## Why it works this way

The parts below are the actual opinions. They are what make the difference
between an agent that builds something and an agent that builds *your* thing.

### The journey spine, and permanent IDs

This is the centre of everything.

After the design doc, the product's user journeys become a YAML file where every
single step gets an ID — `J1.S1`, `J1.S2`, `J1.S3`. Those IDs never change.
If a step's meaning changes, it gets a new ID. It is never recycled.

Then everything cites them:

```
J1.S3  "the lead confirms the pick"
   │
   ├── feature F2 says it serves J1.S3
   ├── the Linear ticket carries J1.S3
   ├── the test is named  it("J1.S3: confirms the pick")
   ├── the PR body says it landed J1.S3
   └── the screenshot proving it is filed against J1.S3
```

This is why the system can run unattended. An agent cannot quietly build
something nobody asked for, because there is nowhere to hang it. If a slice
cannot name the step ID it serves, that is the signal to stop and ask you.

`bun run check-journeys` enforces that the IDs are real. It does not require
every served step to be cited — a first slice correctly leaves later beats
uncited. `bun run check-journeys -- --complete` is clip acceptance.

### The UI gate

A hook denies writes to product UI until the design doc is approved. Fail-closed
— if the state file is unreadable, the write is denied.

No state file at all means no product yet, and the boilerplate itself is
editable. That is the state this repo ships in.

### Read before you invent

The first phase is `salvage`, and it runs on **every** product, not just
rebuilds. Something is always being replaced — if not an old app, then a
spreadsheet, a WhatsApp group, or a paper register.

That thing already encodes what the job requires, refined by people who suffer
when it is wrong. The rule is: **mine it for facts, never for structure.** What
a receipt must legally carry is a fact worth keeping. Which pages the old app
had is the sprawl you are rebuilding to escape.

This is why it asks for your pile before it starts — see
[Where to put your stuff](#where-to-put-your-stuff).

### One vocabulary, everywhere

`ontology` records what the domain calls things — in the domain's own words, not
a framework's. If the site says *pick ticket*, the code says `pick_ticket`, not
`OrderItem`.

Those terms become the only names allowed: tables, types, components, routes, UI
copy. Left unchecked, five parallel agents will invent five reasonable
translations of one word and nobody will be able to grep for any of them.

### Features cannot import each other

`apps/web/src` splits into `app/` (routes), `features/*` (domains), and
`shared/`. Features are forbidden from importing one another — compose them in
`app/`, or hoist the shared piece into `shared/` or a package.

`bun run check-boundaries` enforces this, and it does a second job: **a
boundaries failure is the signal that a piece of logic has earned promotion**,
never a reason to weaken the rule.

### Evidence, not claims

An agent saying "implemented, tests pass" is the failure that compounds across
forty tickets, so every PR carries proof instead: merge-bar output, a test per
cited journey step, and screenshots of the running app.

> **Playwright is not composed yet.** The recipe names it as the intended e2e
> layer and nothing scaffolds it, so there are no traces today. Evidence for the
> first slice is the merge bar, `bun test`, and screenshots you take from
> `next dev`.

Tests and the score answer different questions, and the slice needs both. Tests
say the code does what the spine specified. `bun scripts/eval.ts` replays the
customer's **last ten real cases** and says whether the product would have caught
what actually went wrong:

```
  pass  PBC-14  IAM list was current-state, 4 users deprovisioned before 6/30
  skip  PBC-33  BCP test had never been performed
        A missing control, not a defective artifact. Out of scope by kind.

score: 4 of 10 real cases handled — 4 attempted, 6 out of this slice
```

A slice can be fully green and score 2 of 10. That is a finding for the
checkpoint, not a merge blocker, so the score never gates a PR — it is what you
show them instead of "it works". Cases live in `*.eval.ts` beside the code, and
one the slice does not cover is `skip:` **with a reason**; a skip that quietly
disappears reads as a pass.

The first slice runs without auth, so its screens are reachable by URL and
screenshot cleanly. Once seats land after the clip, screens behind login need a
preview-only route that makes the signed-in state reachable by URL — 404 in
production, secret-gated, seeded users only. **That route is not in the kit
yet**; `PREVIEW_LOGIN_SECRET` and `SEED_USERS` are the hooks waiting for it.

### The stack is a recipe

Edit [docs/kit/recipe.yaml](docs/kit/recipe.yaml) when the default should change.
`bun scripts/compose.mjs --add web --add db` prints the commands. Overlays keep
every clone on feature folders, `@/env`, and shadcn in `packages/ui` even when
package patch versions differ. `--apply` refuses on this kit.

| Layer | Recipe default | Skip |
|---|---|---|
| Install | Bun (`majors.bun`) | npm, pnpm, yarn |
| App | Next.js App Router, `apps/web` | Extra apps until you ask |
| Auth | Clerk | `--without auth` |
| Database | Drizzle + Neon, import `env` from `@/env` | omit `--add db` |
| Jobs | Vercel Workflows | `--without jobs` |
| Analytics | PostHog (errors + product) | `--without analytics` |
| Email | Resend | `--without email` |
| Files | Vercel Blob | `--without files` |
| UI | shadcn in `packages/ui` | Components installed into `apps/web` |
| Agents | Eve, `apps/agent` | until U5 names judgment steps |
| Lint | Biome | ESLint, Prettier |
| Test | `bun test` (Playwright intended, not composed yet) | Vitest, Jest, Cypress |
| Region | `NEON_REGION` at setup | a per-region template |

`customize` composes what the design doc named. Nothing adds a second option
"just in case". Billing and Clerk org UI wait until a product asks. This kit
does not ship Next — compose after U5.

---

## Layout

| Path | Role |
|---|---|
| `apps/` | Empty until compose. Then `web` with `src/app` / `src/features` / `src/shared` |
| `packages/` | Empty until compose. Then `ui` (shadcn) and `db` (Drizzle + Neon) |
| `e2e/` | Empty until compose |
| `docs/kit/` | Stack recipe + overlays. Compose reads this. |
| `docs/` | Design doc, journeys, research — after `/next` |
| `.agents/skills/` | The playbook (phases and child jobs). `.cursor/skills/` and `.claude/skills/` symlink here. Cursor Task adapters in `.cursor/agents/` pin Grok |

## Commands

```bash
bun install
bun run dev
bun run check-types && bun run check-boundaries && bun run check-tokens && bun run check-journeys && bun test
bun run status && bun run check-drift
bun scripts/eval.ts                       # score the slice against the last 10 real cases
bun scripts/compose.mjs --add web
bun run ui:add -- button
bun run db generate && bun run db seed    # seed depends on migrate
bun run db reset                          # local PGlite wedged? throw it away and reseed
```

Lefthook runs Biome, boundaries, and affected typechecks on every commit.

Env: copy `apps/web/.env.example` → `apps/web/.env.local`. Import `env` from
`@/env`, never `process.env`.

**You do not need a database to start.** With `DATABASE_URL` unset, `packages/db`
runs on PGlite — Postgres compiled to WASM, writing to `packages/db/.pglite/`,
no daemon and no account. It refuses that fallback under `NODE_ENV=production`,
so a deploy missing the variable fails loudly instead of serving an empty one.
Clerk runs keyless in `next dev` the same way.

PGlite is single-connection, so only one process may hold it — the dev server
*or* a script, not both. If `next dev` is killed uncleanly the data directory can
be left unopenable, and the failure reads as `RuntimeError: Aborted()` from the
wasm build with no hint about the cause. It is seed data, so throw it away:

```bash
bun run db reset
```

Point it at Neon when you are ready: `DATABASE_URL` (pooled, for the app) and
`DATABASE_URL_UNPOOLED` (direct, for `db push` / `db studio`). `reset` refuses to
run when `DATABASE_URL` is set.

## Branches

| Branch | Role |
|---|---|
| `staging` | Where everything lands. Open PRs here, and branch from here. |
| `main` | Production. Merge `staging` → `main` to release. |

Base and target must match — branch from `staging`, land on `staging`. Rebase
before merging, because five parallel agents make your base stale fast.
Hotfixes are the one exception: branch from `main`, land on `main`, back-merge
the same day.

Both branches run [migrate.yml](.github/workflows/migrate.yml). Additive
migrations only.

## More

Full internal map: [docs/map.md](docs/map.md) · Agent constraints:
[AGENTS.md](AGENTS.md) · Playbook source:
[saas-playbook](https://github.com/hivinaynair/saas-playbook)

[Turborepo](https://turborepo.dev/docs) ·
[Next.js](https://nextjs.org/docs) ·
[Clerk](https://clerk.com/docs) ·
[Drizzle](https://orm.drizzle.team) ·
[Neon](https://neon.com/docs) ·
[shadcn/ui](https://ui.shadcn.com) ·
[Workflow DevKit](https://useworkflow.dev) ·
[Biome](https://biomejs.dev) ·
[Bun test](https://bun.com/docs/cli/test)
