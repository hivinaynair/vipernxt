# FDE loop

How `/next` runs an engagement. Full citations: [docs/research/fde-workflow.md](../research/fde-workflow.md). Tools: [fde-tools.md](fde-tools.md). Skills stay the source of truth for each phase; this is the order and the **stop-before-code** test.

You do not write product UI until gate **U5** is ticked. A probe (baseline counter, shadow log, replay of real cases) is not product UI.

```
U understand → R reframe → P probe → C clip → F factory
```

Live engagements run on a **throwaway clone**, never in this kit. Learnings that generalize come back as playbook — no site names, no piles, no `state.yaml` from a dry-run.

## Two shapes the loop must survive

Use these as dry-run fixtures. They are not products in this repo.

| | **Incumbent replacement** | **Judgment over documents** |
|---|---|---|
| They say | "It's on paper / WhatsApp" | "Automate the practice with AI" |
| U1 often finds | A paid desktop app every transaction already hits | The ledger / ERP / Excel / email — already the SoR |
| U1 also asks | What does the **paid upgrade** already do? Do not reimplement it | Does the vendor's AI/bank feature actually cover *this* site's banks and docs? |
| Obvious build (wrong) | Copy the incumbent's menu into a web app | A CRUD of clients plus a chatbot that posts |
| Real problem | Exceptions and workarounds the menu never named | Work **above** the SoR: classify, file, chase across many entities; posting is the risk |
| Clip | One counter path that moves the U2 number | One judgment loop: ingest → propose → human gate. No auto-post |
| Buckets | Mostly script + human at the counter | Script (arithmetic), judgment (messy docs), human (sign-off / the conversation *is* the service) |
| Seed | Last 10 real tickets/receipts | Last 10 cases, **or** the SoR's own history if it already stores expert-labelled output |
| Shadow | Clip beside the old screen before cutover | Propose without posting until they trust the replay |
| Time-sensitive | If they are about to change the SoR, **measure this week** | Same — after the upgrade you cannot unmix what the vendor fixed from what you did |

If `/next` cannot run both shapes without inventing a site, the kit is wrong — fix the kit, do not park a customer in this tree.

## U — Understand (salvage + field + research)

Input: a **site**, what they use today, the pile. Not an idea.

| # | Do | Done when |
|---|---|---|
| U1 | Incumbent gate — name + photos, or explicit "none". What the **current paid version** already does. If they are about to upgrade/migrate, capture baseline numbers **before** the SoR changes | You are not researching against an unchecked "paper" claim, and you are not about to reimplement a vendor feature |
| U2 | Climb **request → outcome** — "If this works, what number moves in 90 days?" | One baseline metric, current value if known |
| U3 | Watch the work (buyer is not the worker). Capture operational context separately from entities. Where the data may live (this machine / this network) | A dependency graph of the job + exceptions; laminated-card / workaround list; residency constraint if any |
| U4 | Last **10 real cases** (or a week of the job). If the SoR already stores expert-labelled history, that *is* the eval set — anonymize it | Anonymized, frozen, cited to photos/exports/SoR |
| U5 | **Reframe** — outcome, who has the pain, real problem, **one sentence why the obvious build is wrong** | They confirm or correct. Until this exists, no `shape` done, no product UI |

Bucket every step while mapping:

| Bucket | Means | Not |
|---|---|---|
| **script** | Deterministic. Arithmetic, matching, a rule | An agent, a screen |
| **judgment** | Messy interpretation; agent proposes, human gates | Auto-post to the SoR |
| **human-only** | Stays with the person. Three reasons, keep them separate: **judgement** (needs the client), **responsibility** (their name is on it), **relationship** (the conversation *is* the service) | "AI assist" chrome on a conversation that should stay human |

Do not plan a screen for a script step. Do not plan an agent for a human-only step. Recommending they **buy or upgrade the incumbent** is a valid U1 outcome — record it and shrink the clip to what the vendor will never cover (usually the layer across many entities, before the SoR starts).

`who: site` on gathers only the counter can answer. Keep researching while those are open. Mode: **on-site** (live checklist) / **pile** (absorb inbox) / **trip** (`.docx`). Trip is not the default.

## R — Reframe (shape)

The design-doc **claim is the reframe**, not the feature they asked for. The **clip** is the smallest path that would move the U2 number. v1 is that clip. "Earn the right to do more" — do not spine the department.

A request that is this site's habit, not the domain: say so; do not encode it. Confirm the claim with the buyer **and** that it would not make the person who does the job look watched or replaced unless they accepted that.

## P — Probe (optional, still gated)

Ship an instrument on the eval set or live process: replay the 10 cases, count the baseline, shadow log. Not routes under `src/app` / `src/features`. Purpose: test the reframe against reality before the clip is software. For judgment steps, the probe *is* the first eval harness.

## C — Clip (customize from the doc → ontology + spine → wave 0 + first slice)

Ontology = **semantic** context (entities, states, SoR). Journey steps = **operational** context (what the clerk actually does), each tagged script / judgment / human. Seed data **is** the anonymized eval set. The first slice is scored against the U2 number, not "tests pass."

They look at it. That is the mandatory stop.

Shadow before replace: the slice may sit beside the current process before it is the process. A judgment clip proposes; it does not post to the SoR until they say so.

## F — Factory

Only after they accept the clip. Then setup, Linear, structure, parallel slices. Each new slice must still cite a journey ID **and** say which eval cases it covers.

Setup, Linear, and design-system wait until C is accepted. Missing DB/auth keys are one `who: fde` gather, not a nine-step provision.

A kit change that fell out of a dry-run (incumbent gate, eval-set seed, buckets) is the **productize** step. The site stays on its clone.

## Exit tests (print these, not phase names)

- **Understand is done** when U5 is a paragraph they agreed to.
- **Shape is done** when the claim *is* that paragraph and the clip would move the number.
- **Build may start** when the eval set exists and wave 0 can seed it.
- **Factory may start** when they used the clip on a real (or seeded-real) case and did not say the story is wrong.
