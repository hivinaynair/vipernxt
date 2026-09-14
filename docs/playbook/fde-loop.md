# FDE loop

How `/next` runs an engagement. Full citations: [docs/research/fde-workflow.md](../research/fde-workflow.md). Tools: [fde-tools.md](fde-tools.md). Skills stay the source of truth for each phase; this is the order and the **stop-before-code** test.

You do not write product UI until gate **U5** is ticked. An instrument (baseline counter, shadow log, replay of real cases) is not product UI — it belongs in U4, where you still have the cases in front of you.

```
U understand → R reframe → C clip → F factory → G generalize
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

**Somebody told you they have a problem.** A person, who said it, whose name you
can write down — not a market, not a persona. No name, no engagement.

What they use today is the first read on whether anyone pays for this, and it
runs opposite to intuition:

| What they use today | What it tells you |
|---|---|
| Nothing — it lives in their head | Nobody has ever paid to fix this. **Highest risk.** Empty ground is not opportunity |
| Paper, WhatsApp, a register | Labour is the incumbent. You must beat the cost of a cheap person, not the annoyance |
| One piece of software | **They pay for software.** Budget proven, buyer identified. Lowest risk |
| Several tools, bad seams | Budget proven and generous. The pain is the seams, and that is often the best work there is |

| # | Do | Done when |
|---|---|---|
| U1 | Incumbent gate — name + photos, or explicit "none". What the **current paid version** already does. Then **2–3 other vendors** selling this job (pricing, changelog, 2–3★ reviews). **If nobody sells this category anything, ask why they left** — you were not first, and an empty category is usually proof nobody paid. What does this pain cost them **per month, in money**, at local labour rates? If they are about to upgrade/migrate, capture baseline numbers **before** the SoR changes | You are not researching against an unchecked "paper" claim; you are not about to reimplement a vendor feature; the market is cited, not copied; you can say what the pain costs and what you would have to beat |
| U2 | Climb **request → outcome** — "If this works, what number moves in 90 days?" Name who **independently** accepts that it moved (the clerk, a reconciling SoR, not the clip itself) | One baseline metric, current value if known, a verifier who can reject |
| U3 | Watch the work (buyer is not the worker). Capture operational context separately from entities. Where the data may live (this machine / this network) | A dependency graph of the job + exceptions; laminated-card / workaround list; residency constraint if any |
| U4 | Last **10 real cases** (or a week of the job). If the SoR already stores expert-labelled history, that *is* the eval set — anonymize it. **Count the baseline while you have them**: replay the cases, instrument the live process, shadow-log. That number is what the clip is scored against, and it cannot be recovered later | Anonymized, frozen, cited to photos/exports/SoR; the before-number is written down |
| U5 | **Reframe** — outcome, who has the pain, real problem, **one sentence why the obvious build is wrong**, and the **safe fallback** if the clip is wrong (usually: incumbent stays; propose, don't post). Keep `idea:` — do not silently rewrite the brief | They confirm or correct. Until this exists, no `shape` done, no product UI |

Bucket every step while mapping:

| Bucket | Means | Not |
|---|---|---|
| **script** | Deterministic. Arithmetic, matching, a rule | An agent, a screen |
| **judgment** | Messy interpretation. Smallest mechanism that can propose: a rule, retrieval, one model call, then a human gate. Not "therefore an agent" | Auto-post to the SoR |
| **human-only** | Stays with the person. Three reasons, keep them separate: **judgement** (needs the client), **responsibility** (their name is on it), **relationship** (the conversation *is* the service) | "AI assist" chrome on a conversation that should stay human |

Do not plan a screen for a script step. Do not plan an agent for a human-only step. Recommending they **buy or upgrade the incumbent** is a valid U1 outcome — record it and shrink the clip to what the vendor will never cover (usually the layer across many entities, before the SoR starts). The market scan is how you know that without waiting for the field visit.

`who: site` on gathers only the counter can answer. Keep researching while those are open. Mode: **on-site** (live checklist) / **pile** (absorb inbox) / **trip** (`.docx`). Trip is not the default.

Parallel miners are skills (`salvage-miner`, …), not a Cursor feature. Spawn per `next` (**Start a child**). If this harness cannot start a sibling, run them serially. Do not skip them.

## R — Reframe (shape)

The design-doc **claim is the reframe**, not the feature they asked for. The **clip** is the smallest path that would move the U2 number. v1 is that clip. "Earn the right to do more" — do not spine the department.

A request that is this site's habit, not the domain: say so; do not encode it. Confirm the claim with the buyer **and** that it would not make the person who does the job look watched or replaced unless they accepted that.

## C — Clip (ontology + spine → scaffold → structure → wave 0 + first slice)

Surfaces come from [docs/kit/recipe.yaml](../kit/recipe.yaml), not from cloning a
second template. `/next` runs `bun scripts/scaffold.mjs --add …` for what U5
named (`web` / `agent` / `db`). Recipe-selected packages; overlays for feature folders,
`@/env`, shadcn in `packages/ui`. Do not free-hand `create-next-app`.

Ontology = **semantic** context (entities, states, SoR). Journey steps = **operational** context (what the clerk actually does), each tagged `bucket: script | judgment | human`. A script or judgment step often has no screen. Seed data **is** the anonymized eval set. The first slice is scored against the U2 number, not "tests pass."

They look at it. That is the mandatory stop.

Shadow before replace: the slice may sit beside the current process before it is the process. A judgment clip proposes; it does not post to the SoR until they say so. After a write, **read the result back from the SoR** before telling anyone it is done.

## F — Factory

Only after they accept the clip. Then setup, tickets, and scheduled slices. Each new slice must still cite a journey ID **and** say which eval cases it covers.

Setup and external ticket publication wait until C is accepted. Design-system structure precedes the first screen. Missing DB/auth keys are one `who: fde` gather, not a nine-step provision.

A kit change that fell out of a dry-run (incumbent gate, eval-set seed, buckets) is the **productize** step. The site stays on its clone.

## G — Generalize (optional, and only after F)

Every engagement is built for one customer. G is the question you are **allowed**
to ask once that customer is actually using it: does this become a product?

There is no flag for it. You do not declare at U5 that this will be a SaaS —
that is a guess about the future, and the loop refuses those everywhere else. You
enter G when you want to, with a working site behind you.

The failure this exists to prevent: a clip succeeds at one site, you generalize
from a sample of one, and a year later two people use it. The site was not wrong.
The sample was.

| # | Do | Done when |
|---|---|---|
| G1 | **Is this site typical?** How many reachable sites look like it, and how does it differ from the median — size, margin, tech-appetite? A design partner who is excited about technology is the tail of the distribution, not the middle | You can say how this site differs from the ones you have not met |
| G2 | **The same pain, named independently, at three sites** — at least one of them boring. Not "would you use this?" Ask what it costs them today, the way U1 did | Three sites described the pain without being led to it |
| G3 | **Price evidence, not enthusiasm** — a deposit, a signed LOI, or a cheaper thing they already cancelled. "Nice to have" is a no | Somebody who is not your design partner has paid |
| G4 | **What is site-specific in the code?** The clip was built for one site's vocabulary and exceptions. Name what generalizes and what was theirs | A list of what must be pulled out before a second site can run it |

Exits:

| Exit | Do this |
|---|---|
| G2 and G3 pass | Generalize. The second site is a new engagement on the same code, not a rebuild |
| G2 or G3 fails | Record `outcome:` and say so. **One tool for one customer is a finished product**, not a failed SaaS |

## Exit tests (print these, not phase names)

- **Understand is done** when U5 is a paragraph they agreed to.
- **Shape is done** when the claim *is* that paragraph and the clip would move the number.
- **Build may start** when the eval set exists and wave 0 can seed it.
- **Factory may start** when they used the clip on a real (or seeded-real) case and did not say the story is wrong.
- **Handoff may start** when they ran that case **without you**. Documents are not a handoff.
- **Generalize may start** when one site is live and you want to ask the question. **Product may start** when somebody who is not your design partner has paid.

The structure pass precedes the first product screen. `/next` alone owns progression and pauses; phase skills return artifacts. After first-slice acceptance, use the [factory execution design](factory.md).
