# ViperNxt

**Sit with a site. Leave with a clip that moves a number — then a factory.**

ViperNxt is two things in one repository:

1. **A SaaS starter kit** — Bun, Next.js 16, Clerk, Drizzle + Neon, shadcn/ui,
   Biome, Playwright. Wired together, opinions already argued out.
2. **An FDE playbook** — agent skills that run an engagement: salvage the pile,
   watch the work, reframe the request, seed an eval set, ship one slice, then
   (only then) the factory.

You clone it, type `/next`, and name a **site** plus what they use today. It
does the rest, stopping only when it needs something it cannot get for itself —
a decision that is yours, or a fact that exists only at the counter.

This is not "idea in, weekend MVP out." Product UI stays locked until the
reframe exists. Procedure: [docs/playbook/fde-loop.md](docs/playbook/fde-loop.md).

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

- You want a demo app to restyle. `apps/web` is leftover starter copy on
  purpose — there is no product here until you make one.
- You want to pick your own stack. The stack is decided. You may *remove*
  things; you cannot swap them in.
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
  C  clip         customize → ontology + spine → wave 0 seeds the eval set
                  → one journey, working
       │
       ▼  ✋ YOU LOOK AT IT. the only mandatory stop in the build.
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

**This machine (Codex/Cursor on a checkout you can see):** drop the files in
`docs/research/salvage-inbox/`, then:

```bash
node scripts/salvage-inbox.mjs docs/research/salvage-inbox
```

**This chat (Cloud Agent, or any host whose disk you cannot see):** attach the
files to the message. The agent copies them into that folder and runs the same
script. Do not scp. Do not try to open the VM's Finder.

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
node scripts/homework.mjs build docs/product/homework/02-site-visit.md
```

Fill it in, drop the filled copy into `docs/product/intake/`, and it gets read
back:

```bash
node scripts/homework.mjs read docs/product/intake/02-site-visit.docx
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
| `salvage` | Mines prior art for facts — old repos, spreadsheets, photographs of forms. | Phase 0 |
| `field-kit` | Writes your homework, then absorbs what you bring back. | Phase 2 |
| `shape` | The interview. One question at a time → the design doc. | Phase 3 |
| `ontology` | Names the domain's entities and states in the domain's own words. | Phase 3.5 |
| `journeys` | Turns the design doc's journey table into the ID'd spine. | Phase 4 |
| `design-system` | Layout primitives and semantic tokens, before any page exists. | Phase 5 |
| `linear-sync` | Publishes the spine to Linear as tickets carrying step IDs. | Phase 4.5 |
| `customize` | Names your clone, applies keep/strip. | After shape |
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

`bun run check-journeys` enforces that the IDs are real.

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
forty tickets. So Playwright captures traces and screenshots on success, not
only on failure, and every PR carries proof.

For screens behind login, `agent-browser` only accepts a URL — so there is a
preview-only route that makes the signed-in state reachable by URL. It 404s in
production, requires a secret, and signs in seeded users only.

### The stack is closed

| Layer | Use | Skip |
|---|---|---|
| Install | Bun `1.4.x` | npm, pnpm, yarn |
| App | Next.js 16, one `apps/web` | Extra apps until you ask |
| Auth | Clerk | NextAuth, hand-rolled JWT |
| Database | Drizzle + Neon, import `env` from `@/env` | Prisma, `process.env` in app code |
| Jobs | Vercel Workflows | A second queue on day one |
| UI | shadcn in `packages/ui` | Components installed into `apps/web` |
| Lint | Biome | ESLint, Prettier |
| Test | `bun test`, Playwright | Vitest, Jest, Cypress |

`customize` may **remove** something after the design doc says so. Nothing adds
a second option "just in case". Billing and Clerk org UI are not in the tree —
add them when a product actually asks.

---

## Layout

| Path | Role |
|---|---|
| `apps/web` | Routes in `src/app`, domains in `src/features/*`, app-local in `src/shared` |
| `packages/ui` | shadcn (`@repo/ui`). `bun run ui:add -- <component>` |
| `packages/db` | Drizzle + Neon. Server-only. Schema empty until a product needs tables |
| `e2e/web` | Playwright |
| `docs/` | Design doc, journeys, research — after `/next` |
| `.agents/skills/` | The playbook. `.cursor/skills/` and `.claude/skills/` symlink here |

## Commands

```bash
bun install
bun run dev
bun run check-types && bun run check-boundaries && bun run check-tokens && bun run check-journeys && bun test
bun run status && bun run check-drift
bun run ui:add -- button
bun run db generate && bun run db migrate && bun run db:seed
```

Lefthook runs Biome, boundaries, and affected typechecks on every commit.

Env: copy `apps/web/.env.example` → `apps/web/.env.local`. Import `env` from
`@/env`, never `process.env`. Neon needs `DATABASE_URL` (pooled) and
`DATABASE_URL_UNPOOLED` (direct, for migrations).

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
