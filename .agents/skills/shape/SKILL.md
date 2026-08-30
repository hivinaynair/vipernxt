---
name: shape
description: >-
  Shapes a new SaaS before any product code: interviews one question at a time,
  researches the domain, drafts user journeys and low-fi screens, optionally
  shows a Cursor design canvas, and writes a design doc under docs/plans. Use
  when starting a new product, when the product is still uncertain, or when the
  user asks to shape the product, draft journeys, low-fi screens, a design
  canvas, or a design doc.
---

# Shape the SaaS

Interview → research → claim → actors → journeys → low-fi screens → stack. The design doc is written as you go, not at the end; the canvas is an optional Cursor view of it.
Then **stop**. This is not implementation, and not whatever setup or rename checklist the project ships.

Copy this checklist and keep it updated:

```
Shaping:
- [ ] 1. Orient
- [ ] 2. Interview (one question at a time)
- [ ] 3. Research (cited; then a question)
- [ ] 4. Claim — confirmed → **create the doc**
- [ ] 5. Actors — confirmed → append
- [ ] 6. Journeys — confirmed → append
- [ ] 7. Low-fi screens — confirmed → append
- [ ] 8. Stack keep/strip — recorded in the doc, not applied
- [ ] 9. Canvas (view of the doc) — or skipped: host has none
- [ ] 10. Doc read end to end; user said it is right; STOP
```

## Hard gates

Violate none of these:

- **ONE question per message.** Prefer multiple choice. Never dump 8 questions.
- **Research after there is enough to search;** come back with 2–3 findings and a question. Write cited notes under `docs/research/` if useful.
- **The doc is the state.** Create `docs/plans/<date>-<name>-design.md` the moment the claim is confirmed, then append each section as its gate passes. Confirmed work never lives only in this chat.
- **Confirm in order: claim paragraph → actors → journeys → THEN screens.** Do not skip journey confirmation.
- **Canvas only if the host has one.** Step 9 is skippable, not a blocker; every other gate is mandatory.
- **Canvas is a VIEW of the design doc, not a second source of truth.** Canvas files live at `~/.cursor/projects/<workspace>/canvases/<name>-design.canvas.tsx`. Import only from `cursor/canvas`. Read the canvas skill before writing one. Host theme tokens, no hardcoded hex, no emoji/gradients/shadows.
- **Low-fi screens = layout bands + per-role copy.** Not Figma. Not implementing the app.
- **Do NOT write product UI, features, or routes until the user says the design doc is right.**
  Cursor denies writes under `apps/*/src/app` and `apps/*/src/features` until `shape` is
  `done` on the state file. Do not bypass the hook with the shell.
- **Do not invent a second app/login per persona unless the user asks.** Default: one URL, seats/roles, shared state.
- **Respect the project's constraints** as written in its `AGENTS.md` / `CLAUDE.md` / README — package manager, module boundaries, existing vendors. Stack choices are recorded, never applied (step 8).
- **Do not commit the design doc unless the user asks.**
- **After the doc is approved, STOP.** Do not start implementing. Mention writing-plans / implementation only as a next step if they say go.

Question bank: [questions.md](questions.md)  
Doc template: [design-doc-template.md](design-doc-template.md)  
Canvas recipe: [canvas-tabs.md](canvas-tabs.md)

## Words this skill uses

Lock these with the user on first use; they go in the doc glossary.

| Word | Means here |
|---|---|
| **claim** | The one paragraph v1 has to make true: what it is, who for, what it proves, what it is not. |
| **clip** | The short path that demonstrates the claim — idle state → the one action → the payoff or reversal. Not a video; a sequence of beats. |
| **actor** | A person, org, or system in the story. Some actors never click anything. |
| **seat** | A role a user wears at the one URL. Seats share state; switching seats is not a second product. |
| **band** | A horizontal region of a low-fi screen (header, stage, list, actions, evidence) and what sits in it. |
| **gate** | A checklist step that needs the user's confirmation before the next one starts. |

## Not this skill

| They want | Do instead |
|---|---|
| Rename packages, change scopes, strip vendors in the tree | `/next` runs `customize`, then `setup.sh` |
| Product UI, routes, features | Wait for design-doc approval, then a later plan |
| A Figma file or production screens | Stay on low-fi bands (plus the canvas, if the host has one) |

If they want both shape and setup: **shape first**. Record stack choices in the design doc; do not run the project's setup checklist in this session.

If `superpowers:brainstorming` fires too, **this skill wins** for a new product in this repo — it is the same interview with gates, a doc, and a stop. Run one, not both.

## Facts vs decisions

Finding **facts** is your job (this repo, official docs, first-party APIs). Do not ask which package manager the repo uses — read it.

**Decisions** are the user’s. Put each to them and wait.

When a word is overloaded, propose one canonical term, lock it, and use it for the rest of the session. Put locked terms in the design-doc glossary. Do not keep a second glossary as source of truth.

## One turn

Right — one question, context only if it earns its place, a recommendation, and then silence:

```
**Default seat**

Someone opens the URL cold. Whose eyes are they wearing?

- A) Coordinator — sees every request, can approve
- B) Requester — sees only their own
- C) Other (say who)

Recommended: B — the clip lands harder if approval arrives as a surprise.

Reply with a letter, or correct me.
```

Wrong, all of these:

| Turn | Why it fails |
|---|---|
| Six questions in one message, or one question with "and also" | Answers arrive tangled; you cannot tell which was settled. |
| "Here are the actors AND journeys AND screens — confirm?" | Bundled gates confirm nothing. One gate per message. |
| Asking a question you could answer by reading the repo | Facts are your job. |
| Asking the next question in the same breath as accepting an answer | Wait. |
| "Great question!", recapping their answer back at length | Confirm in a clause, then ask. |

## If they already know

Someone arriving with a written brief, or answering three gates in one reply, should not be walked through the full bank.

Extract every answer the brief settles. Lock the terms. Then run the gates that are still genuinely open — usually claim and journeys — and skip the rest by **recording each skipped gate in the doc as an assumption**, worded so a wrong one is obvious on a read-through.

The express lane collapses the interview. It does not skip the doc, and it does not skip the stop.

---

## 1. Orient

Read the project's `README.md`, `AGENTS.md` / `CLAUDE.md`, and enough of the source tree to know its layout, its module boundaries, and which vendors are already wired in (auth, database, jobs, UI kit). Record what you find — step 8 asks about exactly these. Do not edit product code.

If `docs/plans/*-design.md` already exists, check its `## Shaping status` block. Unticked gates mean a shape is in progress — say so and pick up at the next one (see Resume). If every gate is ticked, ask **one** question: revise that doc, or start a new product shape?

Open with one sentence: you are shaping the product before writing product code. Then ask the first question. Do not preview the rest of the bank.

## 2. Interview

Read [questions.md](questions.md). Pick **one** next question whose prerequisites are settled. Prefer the bank’s multiple-choice form. Offer a recommended answer when you have one.

```
**[topic]**
[one or two sentences of context, only if needed]

- A) …
- B) …
- C) Other (say what)

Recommended: B — [one clause why]

Reply with a letter, or correct me.
```

Wait. Do not ask the next question in the same message.

If they paste a brief, extract answers, lock terms, then ask only the next **unanswered** decision. Never re-ask what they already settled.

Skip setup mechanics (package names, scopes, directory renames) unless they block a product decision.

## 3. Research

Once you can name the product, the job it does, and at least one real constraint (audience, integration, regulated surface, “must not leak”), **stop interviewing and research**.

Use primary sources (official docs, specs, source, first-party APIs). Follow claims to the owner. Do not treat blogs as authority.

Return with:

1. Two or three findings (linked).
2. What you recommend changing in the claim, if anything.
3. **Exactly one** follow-up question.

If the notes will still matter after this chat, write `docs/research/<topic>.md` with citations. Match existing `docs/` layout; create `docs/research/` if needed.

Research is a loop: findings → one question → maybe more search. Do not “finish research” as a dump and skip confirmation gates.

A low-fi **prototype** here is the canvas (clip DAG, journey table, screen bands) — throwaway visual to answer a design question. Do not add app routes to explore UI.

## 4. Claim paragraph

Draft **one paragraph**: what it is, who it is for, what v1 proves, what it is not.

Show it. Ask one question: is this the claim, or what is wrong?

Do not proceed to actors until they confirm or you rewrite and they confirm.

On confirmation, **create the doc now**: `docs/plans/YYYY-MM-DD-<name>-design.md` in this product repo (create `docs/plans/` if needed). Date = today, from `date +%F` — do not guess it. `<name>` = kebab-case product name. Use [design-doc-template.md](design-doc-template.md): write the `## Shaping status` block and section 1 only — later sections stay absent until their gate passes, not stubbed with TBD.

Tell them in one line where the doc is and that it grows as gates pass.

## 5. Actors

Who exists. Who owns policy, data, or money. Who never does.

Default unless they ask otherwise: **one URL**, seats or roles, **shared state**. A production org might ship a customer app and an admin console; v1 of a demo or MVP is usually one room with a seat switcher. Switching seats must not create a second world.

Show a compact actor table. Confirm before journeys, then append it to the doc and tick the gate.

**One customer is not the market.** When the product is being built for a first, specific
customer, test every request against: is this the domain, or is this this customer's habit?
Building exactly what the first one asks for produces software for one of them. Treat them
as the first instance of a product, and say plainly when a request looks like a local habit
rather than a domain requirement.

## 6. Journeys

Same clip, one row per seat. Confirm **this table** before any screen layout, then
append it to the doc and tick the gate. Do not invent a second shape.

```markdown
## Journeys

| Seat | Wants | Can click | Sees after beat 1 | Sees at the end |
| Owner | | | | |
```

Forbidden click: which seat never gets the dangerous control — that row must not
list it.

This table is what the `journeys` skill reads. It is not the ID'd spine. After
the doc is approved, that skill expands each row + the clip beats into YAML.

**Reopen.** If they say the journey is the wrong product story — too hard, wrong
payoff, not what they meant — do not restart the bank. Patch **The clip** and
this table, confirm that table only, then stop so `/next` can re-run `journeys`.
Re-ask actors or the claim only if they said those are wrong too.

## 7. Low-fi screens

Only after journeys are confirmed.

For each screen the clip needs:

- **Bands** (header, stage, list, actions, evidence, …) and what sits in each.
- **Copy per seat/role** for the same event.

No pixel mock, no component API, no app files. Confirm, append bands and per-seat copy to the doc, tick the gate. Then stack if not already recorded.

## 8. Stack (record, do not apply)

Ask what is still unknown, one at a time. Bank section F has the options — do not restate them from memory.

Do not silently add an app, auth vendor, ORM, or package manager. Honour the package manager and module boundaries the project already declares.

Append the answers to the doc and tick the gate. Change no dependency and no vendor code in this skill.

## 9. Canvas (skip if the host has none)

**First check the host.** A canvas is a Cursor surface. If `~/.cursor/skills-cursor/canvas/SKILL.md` does not exist, this host cannot render one: tick the gate as skipped, say so in one line, and move to step 10. Do not improvise a substitute — no HTML file, no ASCII diagram, no extra doc. The design doc already carries everything the canvas would show.

If it does exist, read it (and SDK types under that folder) before writing a `.canvas.tsx`.

Follow [canvas-tabs.md](canvas-tabs.md). Create or update the canvas when you have a confirmed claim — add tabs as gates pass; **omit empty tabs**.

When you mention the canvas, markdown-link the absolute path. First canvas in the workspace: one sentence on what a canvas is.

After the design doc exists, the canvas footer cites that file. If they disagree, **change the doc first**, then the canvas.

## 10. Read the doc, then stop

The doc already exists — it grew as the gates passed. Read it **end to end as one document**: add any template section the gates did not produce, reconcile wording between sections written far apart, and make sure no `TBD` survives (if one does, go back and ask one question). Delete the `## Shaping status` block once they approve.

The doc is the product design, not a line-by-line implementation plan. Say so at the top.

Ask one question: is this document right?

- If no: patch the doc (and canvas), ask again.
- If yes: **STOP.** Do not scaffold features, routes, or UI. Do not run the project's setup checklist unless they ask.

You may name what comes next — **only** as a next step, and only if they say go:

1. **`/next`** — it names the clone (`customize`) if the package is still
   `vipernxt`, then [journeys](../journeys/SKILL.md). Do not tell them to type
   `/customize`.
2. `setup.sh` after `PRODUCT` exists — `/next` points at it; do not run it from here.
3. Per-feature work: each feature cites the journey step IDs it serves, and a test title names those IDs.

Do not commit unless they ask.

## Resume

The doc is the state; this chat is not. On a new session or after lost context, read `docs/plans/*-design.md`: the `## Shaping status` block says which gates passed, and the written sections **are** the confirmed answers. Read `docs/research/*` if present. Rebuild the checklist from that, then ask the next unanswered question.

Never re-confirm a section the doc already contains — unless they said that
section is wrong (usually the clip and Journeys table). Do not restart the bank.
