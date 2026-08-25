---
name: salvage
description: >-
  Mines whatever already exists in the domain — an earlier build, the software or
  spreadsheet being replaced, competitors, public complaints — for domain facts,
  and reports what was built that should not be rebuilt. Use at the start of any
  new product, not only when there is an old repo to read.
---

# salvage

**Prior art is almost never absent. It is just usually not yours.**

Every product replaces something. If it is not an earlier build, it is a spreadsheet, a
WhatsApp group, a paper register, a twenty-year-old desktop application, or one person
remembering. That thing already encodes what the job requires, and it was refined by
people who suffer the consequences of getting it wrong.

Read it before inventing anything.

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

## Output

Write `docs/research/salvage.md`:

1. **Domain facts** — each one stated plainly, with where it came from. "A receipt carries
   the trust's registration number, the seva name, the devotee's star and the amount
   (`donations` schema + photographed receipt)."
2. **The vocabulary** the domain actually uses, including words the old build got wrong.
3. **Entities and their real states**, from the schema, not from what feels tidy.
4. **What was built that should not be rebuilt** — features that sprawled, half-finished
   surfaces, anything the git history shows was reworked repeatedly. Say why.
5. **Open questions the prior art raises but cannot answer.** These usually belong in the
   field visit; hand them to `field-kit` rather than guessing.

Cite everything to a file path, a commit, or a photograph. An uncited "fact" is a memory,
and memories are what the rebuild is trying to escape.

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
