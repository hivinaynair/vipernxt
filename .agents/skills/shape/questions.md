# Question bank

Not a questionnaire. Read this file; ask **one** question whose prerequisites are settled. Skip any the user already answered. Prefer the multiple-choice form in `SKILL.md`.

This file is the **only** place the option lists live. `SKILL.md` points here rather than repeating them.

A user who arrives with a brief has already answered much of this. Extract those answers, then ask only what is still open — see "If they already know" in `SKILL.md`.

Do not ask setup mechanics here (package names, scopes, directory renames).

---

## A. Claim (start here)

**A1. Job** — What job does v1 do, in one sentence?

- A) A **demo/clip** for a specific reader (prove one claim in a few minutes)
- B) An **MVP** for real users of a known workflow
- C) An **internal tool** for one team
- D) Other (say the sentence)

Recommended: A if they mentioned a portfolio, job application, or “show X in three minutes”; otherwise B.

**A2. Reader** — Who must believe the claim after using it?

- A) A hiring manager / specialist (name the person or role)
- B) A paying customer persona (name them)
- C) The team that will operate it
- D) Other

**A3. Name** — What do we call the product (human title)? One word or a short phrase is enough. Record a kebab-case slug for the design-doc filename.

**A4. Not-this** — What must we say it is **not**, so v1 stays honest?

- A) Not a full platform / not the underlying protocol / not a competitor clone
- B) Not production-regulated (labels only, stubs)
- C) Both A and B
- D) Other (list the disclaimers)

**A5. Clip** — What is the short path that proves the claim? (Idle state → the one action → the one reversal or payoff.)

Ask as choices only if they already sketched a story; otherwise ask them to describe the clip in 3–5 beats, then reflect it back as a numbered list for confirmation (still one question: “is this the clip?”).

---

## B. Actors (after a claim draft exists)

**B1. Cast** — Who are the actors?

- A) Two **people** + two **institutions/orgs** (people instruct; orgs own policy)
- B) One operator + many end users (roles in one org)
- C) Two companies (B2B), each with a user inside
- D) Other (list names and types)

**B2. Ownership** — Who is allowed to change the important thing (policy, money, records, publish)?

Force a named owner. Reject “the user” if more than one seat exists.

**B3. Surface** — How many URLs in v1?

- A) **One URL**, seats or roles, shared state (default)
- B) Separate customer site and operator/admin (they asked for this)
- C) Other

Recommended: **A**. Do not invent a second app or login per persona unless they pick B or C.

**B4. Default seat** — When someone opens the URL, whose eyes are they wearing? (Must be an actor from B1.)

---

## C. Research follow-ups (after you have searched)

Ask these only when a finding created a real decision. Examples — pick the one that matters, not the list:

**C1. Stand-in** — We can prove the claim with [option you researched] instead of [heavier thing]. Use the stand-in?

**C2. Leak** — Public output may show [what]. It must not show [what]. Is that the line?

**C3. Honest limit** — Docs say [constraint]. Disclose it in the README and v1, or change the claim?

**C4. Vendor** — Keep the vendor the project already wires in [name it], or is it off-story for this claim?

Always attach 2–3 cited findings **above** the single question.

---

## D. Journeys (after actors confirmed)

**D1. Table** — Reflect a journey table with these columns only: Seat / Wants / Can click / Sees after beat 1 / Sees at the end. Ask: is this the journey, or who is wrong?

**D2. Forbidden click** — Which actor must **never** get the dangerous control (publish, refund, approve, delete org)? Confirm that seat’s row has no such click.

**D3. Empty seats** — Any actor who only watches in v1 (no click that changes the world)? Confirm that is intentional.

Do not start screens until D1 is confirmed.

---

## E. Screens (after journeys confirmed)

**E1. Band list** — Propose 4–7 layout bands for the main screen. Ask: missing band, or extra band to cut?

**E2. Voice** — Per-seat copy for the same event (one short line each). Ask: whose voice is wrong?

**E3. More screens** — Does the clip need a second screen (settings, publish receipt, empty state)?

- A) No — one screen, states only
- B) Yes — name the extra screen and its bands
- C) A marketing page plus the app (only if they already asked)

Recommended: A for a demo/clip.

---

**Language**

Which languages does the interface carry at v1?

- A) One language only — name it
- B) Two, with one canonical and the other a translation
- C) More than two (say which, and which is canonical)

Ask this before any screen copy. Changing it later is a rewrite, not a change. A domain
whose vocabulary is not English usually still wants the domain terms untranslated — see
`ontology`.

## F. Stack (record in the doc; do not edit the tree)

Canonical list for skill step 8. Ask only what is still unknown. One at a time.

Read the project's constraints doc first (step 1) and name the actual vendors it ships. Ask one question per vendor, in this shape:

**F1. Auth** — the project wires in [vendor]. For this claim?

- A) Keep
- B) Strip (public clip / no login)
- C) Keep and enable organizations (B2B)

**F2. Database** — [ORM + host] as wired?

- A) Keep
- B) Strip (static artifacts / no persistence in v1)

**F3. Background work** — [jobs/workflow vendor]?

- A) Keep
- B) Strip

**F4. Extra apps** — another app (`marketing`, `admin`) in this repo for v1?

- A) No (default)
- B) Yes (they asked; still do not scaffold it in this skill)

Recommended: A.

---

## G. Close

**G1. Doc** — `docs/plans/YYYY-MM-DD-<name>-design.md` is written. Is this document right?

- A) Yes — stop shaping
- B) No — say which section is wrong

**G2. After yes** — Do **not** ask a bundle of implementation questions. If they volunteer “go build it,” point at the **journeys** skill (spine first), then per-feature work; do not start either until they pick.
