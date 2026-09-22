# FDE loop

How `/next` runs an engagement. Citations: [fde-workflow.md](../research/fde-workflow.md). Tools: [fde-tools.md](fde-tools.md). Skills own each phase; this is the order and the stop-before-code test.

No product UI until **U5**. A baseline counter, shadow log, or eval replay is U4, not UI. Live work runs on a throwaway clone, never this kit.

```
U understand → R reframe → C clip → F factory → G generalize
```

## Two shapes the loop must survive

Dry-run fixtures, not products in this repo.

| | **Incumbent replacement** | **Judgment over documents** |
|---|---|---|
| They say | "It's on paper / WhatsApp" | "Automate the practice with AI" |
| U1 often finds | A paid app every transaction already hits | Ledger / ERP / Excel / email is already the SoR |
| Obvious build (wrong) | Copy the incumbent menu into a web app | CRUD plus a chatbot that posts |
| Real problem | Exceptions the menu never named | Work above the SoR: classify, file, chase; posting is the risk |
| Clip | One counter path that moves the U2 number | Ingest → propose → human gate. No auto-post |
| Seed | Last 10 real tickets | Last 10 cases, or the SoR's labelled history |
| Time-sensitive | If they are about to change the SoR, measure this week | Same |

If `/next` cannot run both without inventing a site, fix the kit — do not park a customer here.

## U — Understand

Input: a **named person** who has the problem, what they use today, the pile. Not an idea. No name, no engagement.

| What they use today | What it tells you |
|---|---|
| Nothing — it lives in their head | Nobody has paid to fix this. Highest risk |
| Paper, WhatsApp, a register | Beat the cost of cheap labour, not annoyance |
| One piece of software | They pay for software. Lowest risk |
| Several tools, bad seams | Budget proven. The pain is the seams |

| # | Do | Done when |
|---|---|---|
| U1 | Incumbent gate — name + photos, or "none". What the **paid version** already does. Then 2–3 vendors (pricing, changelog, 2–3★). Empty category: ask why they left. Monthly cost at local labour rates. About to upgrade: baseline **this week** | Not researching an unchecked "paper" claim; not reimplementing a vendor feature; pain cost named |
| U2 | Request → outcome: what number moves in 90 days, and who independently accepts that it moved | One metric, current value if known, a verifier who can reject |
| U3 | Watch the work. Buyer ≠ worker. Data residency if any | Dependency graph, exceptions, workarounds |
| U4 | Last **10 real cases**. Count the baseline while you have them | Frozen, cited, anonymized; the before-number written down |
| U5 | Reframe: outcome, who has the pain, real problem, why the obvious build is wrong, safe fallback. Keep `idea:` | They confirm. Until then: no `shape` done, no product UI |

| Bucket | Means | Not |
|---|---|---|
| **script** | Deterministic rule or arithmetic | An agent, a screen |
| **judgment** | Messy interpretation → propose → human gate | Auto-post to the SoR |
| **human-only** | Stays with the person (judgement, responsibility, or relationship) | "AI assist" chrome |

Do not plan a screen for a script step or an agent for a human-only step. Buy/upgrade the incumbent is a valid U1 outcome. `who: site` gathers wait on the counter; keep researching while they are open.

## R — Reframe

The design-doc claim **is** the U5 reframe. The clip is the smallest path that would move the U2 number. v1 is that clip. A site habit is not a domain requirement.

## C — Clip

Surfaces from [recipe.yaml](../kit/recipe.yaml). `/next` scaffolds what U5 named. Ontology is semantic; journey steps are operational and tagged `script | judgment | human`. Seed = anonymized eval set. Score the slice against the U2 number.

They look at it. Mandatory stop. A judgment clip proposes; it does not post until they say so. After a write, read the result back from the SoR.

## F — Factory

Only after they accept the clip: setup, tickets, scheduled slices. Each slice cites a journey ID and the eval cases it covers. Design-system structure precedes the first screen.

## G — Generalize (optional, after F)

Ask only once one site is actually using it.

| # | Do | Done when |
|---|---|---|
| G1 | Is this site typical, or the tech-hungry tail? | You can say how it differs from sites you have not met |
| G2 | Same pain, named independently, at three sites (one boring) | Three sites described the pain without being led |
| G3 | Price evidence: deposit, LOI, or a cheaper thing they cancelled | Somebody who is not the design partner has paid |
| G4 | What in the code is site-specific? | List of what must come out before a second site |

G2 and G3 pass → second site is a new engagement on the same code. Either fails → one tool for one customer is a finished product.

## Exit tests

- **Understand** — U5 is a paragraph they agreed to.
- **Shape** — the claim *is* that paragraph and the clip would move the number.
- **Build** — eval set exists and wave 0 can seed it.
- **Factory** — they used the clip on a real (or seeded-real) case and did not say the story is wrong.
- **Handoff** — they ran that case without you.
- **Generalize** — one site is live and you want to ask. **Product** — somebody who is not the design partner has paid.

`/next` owns progression. After first-slice acceptance: [factory.md](factory.md).
