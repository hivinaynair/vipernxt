# Design doc template

Write `docs/plans/YYYY-MM-DD-<name>-design.md` in the product repo. Create it when the claim is confirmed (skill step 4) with `## Shaping status` plus section 1, then append sections as their gates pass — an unconfirmed section is **absent**, not stubbed. Fill every section that applies; delete a section only if it would be empty. Cite first-party links in “What we use.”

Replace angle-bracket placeholders. Do not leave “TBD” in a confirmed doc — go back and ask one question instead.

```markdown
# <Product> design

Date: YYYY-MM-DD
Audience: a React/Next engineer (and future us) who has not lived in <domain>.
Status: architecture locked for v1 unless a fact below is wrong.

This is the product design, not a line-by-line implementation plan. Implementation comes after you say this document is right.

## Shaping status

Which gates have passed. Delete this section once the doc is approved.

- [x] Claim
- [ ] Actors
- [ ] Journeys
- [ ] Screens
- [ ] Stack
- [ ] Canvas
- [ ] Approved

## 1. What we are building, in one paragraph

<One paragraph: what it is, who it is for, what v1 proves, what it is not.>

**Actors** (table): name · type (person / org / system) · what they may do · what they must never do.

**Name.** <Why this word, in one line.>

## 2. Words you need

| Term | Meaning | Like (React/SaaS analogy) |
|---|---|---|
| **<canonical term>** | <one or two sentences> | <familiar analogue> |

_Avoid_ mixing synonyms. If two words were candidates, pick one here and list the other under avoid.

## 3. What <reader> should believe after a few minutes

1. <Claim beat>
2. <Claim beat>
3. <Claim beat>

## 4. Invariants (if the product has a “must not leak / must not happen”)

**Observer:** <who can see the public surface>.

**Must not learn / must not happen:** <bullets>.

**May learn in v1 (disclose in the README):** <bullets>.

**How the dangerous action is constrained** without leaking the private reason, if that applies.

If there is no privacy/threat story, replace this section with **v1 honesty limits** (what is stubbed, labelled, or fake).

## 5. The clip

Idle: <one sentence>.

1. <Beat>
2. <Beat>
3. <Beat>

Who never clicks the dangerous control.

Evidence the clip leaves behind (hashes, receipts, rows) — not an animation.

## 6. UI and journeys

**One URL, N seats, not N products** — unless section 7 says otherwise.

Default seat: <actor>. Shared state: switching seats does not create a second world.

### Screens (low-fi)

For each screen:

1. **<Band>** — <what sits there>
2. …

### Journeys (same clip, each voice)

| Seat | Goal | Clicks | After beat 1 | At the end |
|---|---|---|---|---|
| | | | | |

## 7. What we use, and why (researched)

Decisions below cite first-party docs. If a doc changes, we revisit.

### 7.1 <Choice> — yes / yes with caveat / no

<Paragraph + links.>

Repeat for each real choice (auth, data, proof system, payments, etc.).

ViperNxt defaults to record, not silently change:

- Clerk: keep / strip / organizations
- Drizzle + Neon: keep / strip
- Vercel Workflows: keep / strip
- Bun only; feature-folder boundaries stay

## 8. What we will not use (and why)

| Rejected | Why |
|---|---|
| | |

## 9. Domain I/O (the actual function)

Private vs public data. The function or workflow in numbered steps. What the UI is allowed to print.

## 10. Repo shape (this monorepo)

```
<name>/
  apps/web/           Next.js (Bun, existing ViperNxt layout)
  packages/ui/
  packages/db/        <keep or omit>
  docs/plans/         this file
  docs/research/      <cited notes>
```

Do not invent extra apps unless section 7 said so. Keep `@repo/*` until the customize-clone prompt runs.

## 11. Visual language

Tokens and type, or “follow `packages/ui`.” Light/dark. What must not look like (e.g. a different product’s chrome).

## 12. Risks we accept

- <Honest limits, hardware, trusted setups, stubs>

## 13. Build order (after this doc is approved)

1. …
2. …

Do not execute this list in the shaping session.
```

## Voice

Write for someone who will implement later without this chat. Short sentences. Name actors the same way everywhere. No emoji. Link primary sources in section 7.
