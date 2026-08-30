# Spine schema

One YAML file per product (or per large surface). Keys not listed here are ignored
by the renderer, so notes are safe to add — but anything the team relies on should
be in the schema, not freeform.

How to fill this file: [SKILL.md](SKILL.md) (read the design-doc tables, then
expand). Keys not listed here are ignored.

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
    reusable: false              # true = other journeys may `uses` this one
    entry: J1.S1                 # optional JourneyEntry; default first step
    exits:                       # JourneyExits — only if endings must be named
      - id: matched
        title: Balance matches
    steps:
      - id: J1.S1                # <journey id>.S<n> or .S<n><letter>
        title: <one line>
        screen: <screen id>
        state: <one of that screen's states>
        sees: <what is on screen at this moment>
        does: <the action they take>
        next: J1.S2              # Transition; omit = terminal
        # next:                  # labeled Transitions when outcomes differ
        #   - { to: J1.S3, when: supported file }
        #   - { to: J1.S2b, when: unsupported format }
        uses: J0                 # CompositeState — this step is journey J0
        exit: matched            # names a JourneyExit; illegal with next
        satisfaction: 1-5        # optional; enables the Mermaid journey diagram
        criteria:
          - WHEN <trigger> THE SYSTEM SHALL <behavior>

features:
  - id: F1                       # F<n>
    title: <one line>
    serves: [J1.S1, J1.S2]       # the steps this feature delivers
```

`next` accepts a step id, a `{ to, when }` edge, or a list of either. `when` is
the Transition label. A `uses` step maps each child JourneyExit on `next.when`,
unless it has exactly one unlabeled `next`.

## What validation enforces

Errors (spine is invalid, exit 1):

- `product` present, at least one journey
- ID formats: `J1`, `J1.S1` or `J1.S2b`, `F1`; step IDs prefixed by their journey
- no duplicate step IDs
- `actor`, `screen`, and `serves` references resolve
- `state` is one of that screen's declared states
- `next` resolves inside the same journey, and never points at itself
- `uses` names another journey; child exits are mapped on `next.when`
- `exit` names a declared exit; `exit` and `next` cannot both be set
- if the journey declares `exits:`, every terminal step names one
- every step is reachable (`entry` or first step, or something points at it)
- every journey has at least one terminal step
- `satisfaction` is 1–5

Warnings (advice, exit 0):

- a step with no screen (unless it `uses` a child), or no criteria
- a criterion with no `SHALL` — probably not EARS
- a screen no step uses
- a feature that serves nothing
- `uses` of a journey not marked `reusable: true`
- a declared exit no step names

## Why EARS and not Gherkin

EARS is one sentence: `WHEN <trigger> THE SYSTEM SHALL <behavior>`. It converts
directly into a test name and it does not tempt anyone into writing UI scripts.
Gherkin's Given/When/Then invites step definitions, which is a second artifact to
maintain — the exact thing that killed feature files at most shops.

## Why the generated markdown, and not just diagrams by hand

The renderer is the only automated consumer of the spine. It is what makes a
malformed spine fail loudly instead of quietly rotting. Hand-drawn Mermaid has no
such check.

## Why not the full W3C User Journey Graph

The [UJG community group](https://www.w3.org/groups/cg/ujg/) is an editor's draft
for a machine-readable journey graph. We write YAML the design doc can feed and
the validator can check. Agents are not asked to speak UJG. Revisit if the spec
becomes a stable TR and we need runtime observation.
