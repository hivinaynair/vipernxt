# Design doc template

`docs/plans/YYYY-MM-DD-<name>-design.md`. **Two pages, hard cap.** Follow the `artifacts`
house rules.

This document holds only what no other artifact holds. It does not repeat:

| Belongs elsewhere | Lives in |
|---|---|
| Entities, vocabulary, states | `docs/product/ontology.md` |
| Journeys, screens, criteria | `docs/journeys/<name>.yaml` |
| Repo layout, package manager, boundaries | `AGENTS.md` |
| Colour, type, density | `DESIGN.md` |
| Build order | Linear |

Write it as the gates pass — section 1 when the claim is confirmed, the rest as they land.
An unconfirmed section is absent, not stubbed. No `TBD` in a finished doc; go and ask.

---

```markdown
# <Product>

<date> · <one line: what it is, for whom>

## Claim

<One paragraph. What it is, who it is for, what v1 proves, what it is not.>

## Actors

| Actor | Type | May do | Must never do |
|---|---|---|---|
| | person / org / system | | |

Default seat: <actor>. <One URL, seats, shared state — or say why not.>

## The clip

The short path that proves the claim.

Idle: <one sentence>

1. <beat>
2. <beat>
3. <beat>

Evidence it leaves behind: <rows, receipts, hashes — not an animation>

## Not this

| Not | Why it matters |
|---|---|
| | |

## Stack

| Choice | Decision | Why |
|---|---|---|
| Auth | keep / strip / orgs | |
| Database | keep / strip | |
| Background work | keep / strip | |

Decisions recorded, not applied. Cite first-party docs where a choice turned on a fact.

## Honest limits

- <what is stubbed, faked, or labelled in v1>
- <what it may leak, and what it must not>

## Open questions

- <unresolved, and who or what settles it>
```

---

## Voice

Written for someone implementing this later without the conversation. Name actors the
same way everywhere — the same way the ontology names them. No emoji. If a section would
be empty, delete it.
