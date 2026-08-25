---
name: design-system
description: >-
  Two halves. Structure builds the component inventory and layout primitives from
  the journey spine so screens are assembled from known pieces. Visual picks the
  palette, type and density and writes DESIGN.md. Use when starting UI work, when
  screens look inconsistent or generic, or when the user wants to pick a look.
---

# design-system

Two halves that run at different times and need different things from the user.

**Structure** blocks the build, needs no visual taste, and is cheap.
**Visual** is optional, needs their eye, and can happen whenever.

Doing structure late is what makes a re-skin turn into a rewrite. Doing visual early is
what stalls a product nobody has used yet.

---

Follow the `artifacts` house rules for anything you write: front-load the
finding, cite every fact, table anything parallel, respect the cap.

## Structure

Runs before any page is written. Default component library, default look, no opinions
about colour.

### What is cheap to change later, and what is not

Say this to the user once, because it governs the whole approach:

- **Cheap:** palette, radius, fonts, shadows. Token values in one file.
- **Expensive:** density, spacing rhythm, information hierarchy, composition. If every
  page improvises its own spacing and layout, "make it feel tighter" means editing every
  page. Hierarchy is not a skin at all.

Structure exists to keep the expensive things centralised so the cheap things stay cheap.

### 1. Inventory from the spine

The journey spine already names every screen and its bands. Read it — do not invent a
component list from imagination.

For each band across all screens, work out what renders it. Group the repeats: six screens
with a "list of things with filters above" is **one** component, used six times.

Write `docs/product/components.md`: each component, which bands it serves, which journey
steps depend on it, and whether the UI library already provides it, needs composing from
primitives, or must be built.

### Shared, or duplicated

When two features need the same thing, the options are hoist it to shared code, compose
both in `app/` instead, or duplicate. Features never import each other.

Hoisting is right when it is genuinely one thing. The test is not whether the two look
alike today — it is **whether a change to one is necessarily a change to the other**.

The spine answers that better than taste does. Two uses serving the **same journey step**
are one thing: hoist. Two uses serving **different steps** are two things that currently
resemble each other, and they will diverge the moment one step's requirements move.
Duplicate, and hoist later if they stay identical through real use.

Data access and UI behave differently here. A shared way to read a booking is almost
always worth hoisting — one place that knows the query. A shared UI component is far more
likely to drift, because two steps rarely stay visually identical once real content lands.

The symptom of hoisting too early is a shared component growing boolean props, one per
caller. When that starts, split it back apart; the abstraction was wrong, not incomplete.

### 2. Layout primitives first

Before feature components: `Page`, `Section`, `Toolbar`, list and table shells, empty
states. These own spacing and density. Every screen composes from them, so changing
density later is four files.

The states matter as much as the happy path — the spine lists them. Empty, loading, error
and over-full are where a product feels unfinished, and they are cheapest to build now,
alongside the component, rather than retrofitted per page.

### 3. Semantic tokens only

Never raw palette values in a component — always the semantic token. Add a check that
fails the build on raw values, in the same place the project's other checks run. A
convention nothing enforces is a convention that lasts three weeks.

### 4. Then pages

Build the inventory before the screens that use it. This single ordering rule is most of
the difference between a product that looks designed and one that looks assembled.

---

## Visual

Optional, and never blocks anything. Run it when the product is usable and the user wants
to look at it.

### Why default-everything looks generated

Stock components, default radius, default font and default spacing *are* the house style
of every AI-built app. Nothing is wrong with any single choice; the problem is that no
choice was made. What reads as considered is a type scale with intent, deliberate density,
one accent used sparingly, and consistent rhythm.

### 1. Show directions, do not describe them

Never describe a look in prose. Build two or three genuinely different directions as
artboards on a canvas — the same real screen from the spine, populated with real content
from the field research, rendered three ways. Let them point.

Name the **axis** the directions differ on before building any of them, and say what each
one's answer is. Different means different: not three shades of the same blue. Vary type,
density and weight, not only hue.

A sloppy direction teaches nothing — it loses on execution rather than on direction, so
nothing is learned about the approach it represented. Give each one real content from the
field research.

State each one's tradeoff and **do not open with a recommendation**. This is the deliberate
exception to recommending everywhere else: nobody can be argued into liking something.

For component-scale questions during the build, `prototype` does this same job at smaller
scale.

### 2. Write the tokens

Once they pick, write the values into the project's token file, replacing the library's
defaults deliberately — including the ones that happen to match, so the file records
choices rather than leftovers.

### 3. Write DESIGN.md

Tokens say which values exist. `DESIGN.md` says how to compose with them, and it is what
gets read before writing a screen. It carries:

- **Colour roles** — what each token is for, and where it is not allowed. Which one is the
  accent, and how rarely it appears.
- **Type** — the scale, and what each level is *for*. When something is a heading versus
  emphasised body.
- **Space and density** — the base scale, gutters, content width, how much air a screen
  gets.
- **Taste rules** — what this product should feel like, what it must never look like, and
  the specific anti-patterns to refuse.

Scope it to the files it governs so it loads when UI is being written and not otherwise.

Without this file, an agent rebuilds the generic look one screen at a time, no matter what
the tokens say.
