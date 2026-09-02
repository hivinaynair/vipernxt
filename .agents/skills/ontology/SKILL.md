---
name: ontology
description: >-
  Models the domain as entities, properties, links and actions in the domain's own
  vocabulary, before any schema or journey work. Use after the claim is confirmed
  and before the journey spine, when the data model is unclear, or when the same
  thing is being called three different names.
---

# ontology

Forward-deployed engineers spend their first two days modeling the customer's domain —
entities, properties, link types — before building anything. The reason they give is that
applications fail without it. They fail slowly, as schema churn: six months of migrations
discovering what the domain already knew.

This runs after the claim is confirmed and **before** the journey spine, because journey
steps act on entities and their acceptance criteria name entity actions.

Follow the `artifacts` house rules for anything you write: front-load the
finding, cite every fact, table anything parallel, respect the cap.

## It is not a database schema

A schema is a storage decision. An ontology is a description of the world the product
operates in, and it survives changing your database.

Four parts:

- **Entities** — the things that exist. `Booking`, `Devotee`, `Receipt`, `Seva`.
- **Properties** — what each one carries, including the ones that turn out to be required
  only after real use.
- **Links** — how they relate, and the cardinality that is actually true. Not the one that
  is convenient.
- **Actions** — what can be done to each, and by whom. *book*, *cancel*, *refund*,
  *issue receipt*, *file monthly return*. This is the part people skip and the part that
  makes the model real.

## In the domain's words, not yours

The names come from the people who do the work, from the salvage notes, and from the
printed artifacts — never from convenience or from a framework's conventions. If the
temple says *seva* and you write `ServiceBooking`, every conversation from now on needs a
translation step, and the translation will eventually be done wrong by someone.

Where the domain uses one word for two things, or two words for one, that ambiguity is a
finding. Name it, pick one canonical term, record the rejected synonym, and use it
everywhere afterwards — including in the code.

## Where it comes from

In priority order:

1. **Printed artifacts.** A receipt is a specification. Every field on it is required, was
   argued about once, and often has a legal reason.
2. **The incumbent's data.** Its tables and its always-empty columns are both evidence.
3. **Field notes.** What people count, what they file, what they look up.
4. **Regulatory or domain documents.** What must be reported, and in what shape.

An entity nobody in the field mentioned is one you invented. Justify it or drop it.

## The states matter more than the fields

For each entity, list the states it can be in and the transitions between them. A booking
is not a row — it is *requested → confirmed → performed → receipted*, with *cancelled* and
*refunded* hanging off it. Most bugs and nearly all awkward UI live in the transitions
nobody drew.

Journey steps then act on these transitions, which is what makes the spine and the model
agree by construction.

## Output

Write `docs/product/ontology.md`:

1. **Entity table** — name, one-line definition in domain words, where the definition came
   from.
2. **Per entity**: properties, links, states with transitions, actions and who may perform
   each.
3. **Vocabulary** — canonical term, rejected synonyms, and any word the previous build or
   the incumbent got wrong.
4. **Open questions** — pairs you could not resolve. These go to the next field visit;
   guessing here is expensive later.

Confirm it with the user before the spine is drafted. One question: which entity is wrong?

## Then hold the line

Once confirmed, this vocabulary is used everywhere — journey steps, acceptance criteria,
Linear issues, table names, component names. A domain model that survives only in one
document is a glossary. One that reaches the schema is an ontology.

`plan` and `build` read this file before writing anything, and the canonical terms are the
**only names allowed** — tables, columns, types, components, routes, seed data, UI copy. A
rejected synonym appearing in the code is a defect, not a style preference.

This matters most when several agents build at once. Left alone, each one invents its own
reasonable translation, and one thing ends up with three names that nobody can grep for.
The list exists so that cannot happen.
