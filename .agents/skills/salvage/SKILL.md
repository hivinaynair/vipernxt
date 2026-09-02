---
name: salvage
description: >-
  Mines whatever already exists in the domain — an earlier build, the software or
  spreadsheet being replaced, competitors, public complaints — for domain facts,
  and records what was built and did not survive. Use at the start of any new
  product, not only when there is an old repo to read.
---

# salvage

**Prior art is almost never absent. It is just usually not yours.**

Every product replaces something. If it is not an earlier build, it is a spreadsheet, a
WhatsApp group, a paper register, a twenty-year-old desktop application, or one person
remembering. That thing already encodes what the job requires, and it was refined by
people who suffer the consequences of getting it wrong.

Read it before inventing anything.

## First, check the premise

The idea paragraph is a **claim, not a fact**, and the claim most often wrong is what the
job runs on today. "They do it on paper" usually means nobody looked at the counter.

So before mining anything, answer this yourself:

> What software, if any, is already being used for this job — what is it called, who sells
> it, what does it cost, and does every transaction go through it?

Ask them only what they alone can know (what is on the machine); everything after that —
the vendor, the price, the reviews — is yours to find. A paid incumbent that every
transaction already flows through changes what the product *is*: you are replacing
software, not digitising paper. Discovering that in phase 3 means the design doc was
drafted against a premise that was never true.

If the premise turns out wrong, say so plainly and record the correction on the phase.
Reopening phase 0 is normal; carrying a false premise forward is not.

## The rule

**Mine for facts, never for structure.**

Facts are what the domain is: what a receipt must legally carry, what states a booking
moves through, what the accountant files monthly, which fields turned out to be required
after real use. These are expensive to learn and cheap to carry over.

Structure is what the last build decided: which pages exist, how features were split, what
the navigation looked like. Copying that reproduces the sprawl you are rebuilding to
escape. The old app having sixteen features is evidence about scope creep, not a
specification.

If you catch yourself writing "the new app should have a devotees page because the old one
did" — that is structure. Stop.

Follow the `artifacts` house rules for anything you write: front-load the
finding, cite every fact, table anything parallel, respect the cap.

## Sources, in order of trust

**When there is an earlier build of this product** — the best case, and rare.
The schema is the highest-value artifact in the repository: it is the domain model
somebody converged on after real use. The git log matters too, because whatever was
reworked repeatedly marks where the model was wrong.

**The incumbent.** Whatever people use to do this job today, however unglamorous —
a legacy application, an Excel file, a printed register. Usually the single richest
source, because it survived contact with reality for years. Ask for screenshots or
photographs; ask what the columns mean and which ones are always left empty.

**Physical and printed artifacts** — receipts, forms, reports, the thing that gets
handed to a customer. These carry hard requirements, often legal ones, that nobody
thinks to mention out loud.

**Public complaints about the incumbent and its competitors.** One-star reviews,
support forums, subreddits, feature-request threads. This is the highest-yield source
for a genuinely new product and the one people skip. Nobody writes a paragraph about
software that works; a furious review names the exact workflow that broke and why it
mattered. Read the two- and three-star reviews most closely — one-stars are often
about billing or support, threes about the product.

**Competitors, read as products.** Onboarding flow, pricing page, docs, changelog. The
pricing page tells you who they think the customer is; the changelog tells you what they
got wrong and had to fix.

**Adjacent domains.** Someone has solved this shape in another vertical. A booking
system for clinics knows things a booking system for temples needs.

Work these in parallel: dispatch one independent investigation per source, then
reconcile. Do not read six sources serially in one context.

## When the prior art is a pile, not a repository

Most of the time there is no repo. There is a folder of photographs, a spreadsheet
someone exported, screenshots of a desktop application, a wireframe drawn last month.

**Ask for the pile before reading anything, and ask physically** — "send me anything you
have" returns nothing; a checklist returns a folder. That request is one held item,
`kind: gather`. Do not start mining a half-empty inbox.

Read [pile.md](pile.md) for the checklist, the normaliser, and what each kind of artifact
is worth. Do not improvise those from memory — the transcription rule in particular is
what keeps every later phase able to cite a photograph.

## Output

Write `docs/research/salvage.md`:

1. **Domain facts** — each one stated plainly, with where it came from. "A receipt carries
   the trust's registration number, the seva name, the devotee's star and the amount
   (`donations` schema + photographed receipt)."
2. **The vocabulary** the domain actually uses, including words the old build got wrong.
3. **Entities and their real states**, from the schema, not from what feels tidy.
4. **What the prior art abandoned** — what was built and did not survive. A feature
   imported by no route, a column added and dropped two commits later, a surface reworked
   four times, a screen the docs call essential that was never built. Record **what was
   built, the evidence it died, and what it cost**. Stop there. See below.
5. **Open questions the prior art raises but cannot answer.** These usually belong in the
   field visit; hand them to `field-kit` rather than guessing. Everything in 4 that you
   cannot explain belongs here as a question.

Cite everything to a file path, a commit, or a photograph. An uncited "fact" is a memory,
and memories are what the rebuild is trying to escape.

## Salvage does not decide scope

There is a strong pull, once you have read a build that sprawled, to write the list of
things the new one must not do. Resist it. Salvage runs before the claim is confirmed,
before the field visit, before anyone has said what the product is for. A prohibition
written that early is a scope decision made from the weakest possible evidence — the last
team's mistakes — and it arrives dressed as a finding, which means every agent downstream
reads it as settled.

So the section records **what happened**, not **what to do about it**:

| Write this | Not this |
|---|---|
| `ExportPanel` exists under `src/features/` and is imported by no route | Do not rebuild the export panel |
| `service_type` enum added in `a1b2c3d`, deleted in `962713a` | Do not add a service-type enum |
| Deceased/sponsor/occasion columns added then dropped (`5aa7510`) | Shraddha is out of scope |
| The tax-filing surface exists; nothing in the stated problems mentions tax | Tax is not our problem |

The left column survives the product changing. The right column is a guess about a product
that does not exist yet.

**Where the verdict actually gets made:** `shape` decides what the product claims, and the
claim is what excludes things — an abandoned feature that the claim does not cover is out
because the claim does not cover it, not because the last build failed at it. `plan` then
decides what a slice contains. Both of them read this section as evidence. Neither should
find its conclusion already written.

The abandoned list has a better use than prohibition anyway: it is the sharpest interview
material `shape` will get. "The last build built stock tracking and never linked it to
anything — do you actually count stock?" is a far better question than a line in a
document saying inventory is out of scope.

Two things that keep leaking into this section and do not belong anywhere in salvage: a
**design decision** ("store a code, localise the label") — that is `ontology` or `plan`;
and a **statistic from an article** — that is research. Salvage reads what people built.

## The competitor trap

Mining competitors is how products become clones. The facts/structure rule matters most
here, and the test is simple: a fact survives when the competitor is deleted from the
sentence. "Bookings must be cancellable up to 24 hours ahead because temples refund by
hand otherwise" is a fact. "They have a cancellations tab" is their structure.

Never copy a flow, an information architecture, or a pricing model because a competitor
has one. Take what their existence proves about the domain.

## When there really is nothing

Occasionally the domain is genuinely new, or everything is behind a login you do not have.
Say so in one line, list what you looked at, and move to research. Do not pad a report to
justify the phase — a manufactured salvage document is worse than no document, because
someone downstream will treat it as evidence.

## What this is not

Not an audit, not a migration plan, not a critique of anyone's build. Nobody needs a list
of the old thing's bugs — it is being replaced. The only question is what it knew that
you do not.

Not research either. Salvage reads **what people built**; research reads **what is
documented** — specs, rules, official docs; field research watches **what people do**.
When those three disagree, that disagreement is the most valuable finding in the pipeline.
