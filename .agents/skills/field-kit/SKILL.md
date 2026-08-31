---
name: field-kit
description: >-
  Writes the field-research homework — who to talk to, what to ask, what to
  observe, what to collect — then turns what comes back into cited findings. Use
  when the product serves people the user is not, before shaping something in an
  unfamiliar domain, or when the user returns from talking to real users.
---

# field-kit

The one phase no agent can do. Your job is to make the trip worth taking, and to make what
comes back usable.

Two modes: **prepare** the homework, and **absorb** what returns.

---

Follow the `artifacts` house rules for anything you write: front-load the
finding, cite every fact, table anything parallel, respect the cap.

## Prepare

Write `docs/product/homework/<nn>-<topic>.md`. It is a form to fill in on site, not an
essay to read beforehand.

### First, do your own work

Never send someone out for something you could find yourself. Read the repo, the salvage
notes, the research. The homework should contain only what exists in the world and nowhere
else: how people actually work, what they actually do when the system fails, what is
written in the margins of the register.

### Who to talk to

Name roles, not "users". The most valuable person is almost always the one who uses the
current system all day and is never asked — the counter clerk, the dispatcher, the ward
nurse. Include at least one person who owns money or reporting, and at least one person
the software is done *to* rather than *by*.

### The questions

These rules are not stylistic. They decide whether the trip produces data or noise.

**Ask about their life, not the idea.** Do not describe what you are building. A described
product produces politeness, not information.

**Ask about the past, never the future.** "Walk me through yesterday" is data. "Would you
use an app that…" is a wish, delivered by someone who wants you to feel good.

**Listen more than you talk.**

Three kinds of answer are worthless, and the questions that produce them are the ones to
delete: **compliments** ("that sounds great"), **hypothetical fluff** ("I'd definitely…"),
and **wishlists** ("it should also do…").

**Screen your own output before it reaches them.** Read back every question you wrote. Any
question that asks about the future, describes the product, or invites an opinion instead
of an account — rewrite it as a question about a specific past event. Do this before the
file is handed over, not after the visit fails.

Good shapes:

- Walk me through yesterday, from opening to closing.
- Show me the last ten you did.
- What happened the last time it broke?
- What do you keep on paper that the system does not hold?
- Who calls you, and about what?
- What happens at month end?
- What did the last audit or inspection object to?

### What to observe

Watching beats asking, and the file should say so explicitly. Sit somewhere for two hours
on a normal day and two on a busy one. Time one transaction. Count the peak. Photograph
every screen of the current system, every printed artifact, every register page.

### Structure it in stages

One stage per person or setting. Each stage carries: who, where, what to ask, what to
capture, and a **done when** line that is checkable — "photographed all screens of the
booking flow", not "understood the booking flow". Number the stages and show how many
there are, so progress is visible on site.

Finish with the **open questions from earlier phases** this trip should settle.

### Hand over something they can fill in

A markdown file in a repo is not a form. Run:

```
node scripts/homework.mjs build docs/product/homework/02-temple-visit.md
```

It renders a `.docx` with every question and capture as a row with an empty box beside
it, one stage per page. They type into it; nobody has to touch the repo, and nobody has
to be taught anything about markdown. Do this every time — do not hand over the `.md` and
do not improvise a renderer.

**The markdown stays the source of truth.** The `.docx` is a render. Edit the homework in
the `.md` and rebuild; never edit the `.docx` to change a question, or `state.yaml` will
be pointing at a file that no longer says what was asked.

Write the homework so it renders well — the convention is small:

| In the markdown | In the document |
|---|---|
| `## Stage 2 — the counter clerk` | Heading, starts a new page |
| `### What to ask` | Sub-heading |
| `- Walk me through yesterday.` | Question, with an answer box |
| `- [ ] Photograph every screen` | Capture, with a tick box and an answer box |
| Anything else | Instruction — no box, nothing to fill |

So: anything you want an answer to is a bullet. Anything that is context is a paragraph.
If a question has no box next to it in the document, it was written as prose and they will
skip it.

---

## Absorb

They come back with photos, scribbled notes, voice memos, a PDF of a receipt, dumped into
`docs/product/intake/`. Raw is fine — formatting is not their job.

Read the filled document back with:

```
node scripts/homework.mjs read docs/product/intake/02-temple-visit.docx
```

It prints each question with the answer underneath and a count — `14/22 answered`. That
count is what the item's `done_when` is checking, so read it before deciding the trip is
finished. Photographs and anything else in the pile go through
`scripts/salvage-inbox.mjs` first, so they are readable and captioned.

Turn it into `docs/research/field-<topic>.md`:

1. **What was observed**, separated from what was said. An observation outranks a claim.
2. **Direct quotes**, attributed to a role. Keep their words; they are the most valuable
   thing in the file.
3. **Facts, each cited** to a photo, a quote, or an artifact.
4. **What contradicts** the research, the salvage notes, or an assumption already recorded.
   These are the highest-value findings in the whole pipeline — surface them loudly.
5. **What is still open**, and whether another trip is needed.

One visit is the start of a relationship, not a completed phase. Forward-deployed teams
treat customer conversation as ongoing engineering work, not a discovery milestone that
closes. Expect the spine to be revised by later conversations, and treat "go back and ask"
as a normal move rather than an admission that the first trip failed.

Watch for the three worthless answer types in what came back and mark them as such rather
than treating them as findings. A compliment recorded as a requirement is how a product
gets built for nobody.
