# Spine schema

One YAML file per product (or per large surface). Keys not listed here are ignored
by the renderer, so notes are safe to add — but anything the team relies on should
be in the schema, not freeform.

```yaml
product: <slug>                  # required
source: docs/plans/<doc>.md      # the design doc this spine views

actors:
  - id: <slug>                   # referenced by journey.actor
    name: <human name>
    type: person | org | system

screens:
  - id: <slug>                   # referenced by step.screen
    route: /app/thing/[id]       # optional; the real route once it exists
    bands: [header, stage, ...]  # low-fi layout bands from the design doc
    states: [empty, loaded, ...] # every state the screen can be in

journeys:
  - id: J1                       # J<n>
    title: <one line>
    actor: <actor id>
    goal: <what they are trying to do>
    proves: <which claim beat this demonstrates>
    steps:
      - id: J1.S1                # <journey id>.S<n>
        title: <one line>
        screen: <screen id>
        state: <one of that screen's states>
        sees: <what is on screen at this moment>
        does: <the action they take>
        next: J1.S2              # omit = terminal; list = branch
        satisfaction: 1-5        # optional; enables the Mermaid journey diagram
        criteria:
          - WHEN <trigger> THE SYSTEM SHALL <behavior>

features:
  - id: F1                       # F<n>
    title: <one line>
    serves: [J1.S1, J1.S2]       # the steps this feature delivers
```

## What validation enforces

Errors (spine is invalid, exit 1):

- `product` present, at least one journey
- ID formats: `J1`, `J1.S1`, `F1`; step IDs prefixed by their journey
- no duplicate step IDs
- `actor`, `screen`, and `serves` references resolve
- `state` is one of that screen's declared states
- `next` resolves inside the same journey, and never points at itself
- every step is reachable (first step, or something points at it)
- every journey has at least one terminal step
- `satisfaction` is 1–5

Warnings (advice, exit 0):

- a step with no screen, or no criteria
- a criterion with no `SHALL` — probably not EARS
- a screen no step uses
- a feature that serves nothing

## Why EARS and not Gherkin

EARS is one sentence: `WHEN <trigger> THE SYSTEM SHALL <behavior>`. It converts
directly into a test name and it does not tempt anyone into writing UI scripts.
Gherkin's Given/When/Then invites step definitions, which is a second artifact to
maintain — the exact thing that killed feature files at most shops.

## Why the generated markdown, and not just diagrams by hand

The renderer is the only automated consumer of the spine. It is what makes a
malformed spine fail loudly instead of quietly rotting. Hand-drawn Mermaid has no
such check.

## Why not the W3C User Journey Graph

The [UJG community group](https://www.w3.org/groups/cg/ujg/) is defining exactly
this — journeys, states, transitions, nesting, plus a runtime model for real user
events. It is the right long-term target and this schema deliberately borrows its
shape (states and transitions, not just an ordered list of tasks). It is an
editor's draft and not stable, so we do not depend on it yet. Revisit when it
reaches a stable technical report.
