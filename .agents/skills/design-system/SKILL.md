---
name: design-system
description: >-
  The two rules that must hold before pages get written — layout primitives so
  density is changeable, and semantic tokens only — plus what a later visual pass
  can and cannot fix. Use before the first screens are built, or when the app
  looks inconsistent.
---

# design-system

Most of "the look" is genuinely cheap to change later. One thing is not, and that is the
only reason this skill exists.

## What a later CSS change fixes, and what it does not

**Fixed by editing tokens in one file:** palette, radius, fonts, shadows, light and dark.
These are CSS variables the component library reads. Change them whenever you like — the
whole app follows. Defer this happily.

**Not fixed by any token change:** spacing rhythm, density, and information hierarchy.
Those live in `className` strings on every page, not in CSS. If thirty screens each
improvise their own padding and grid, "make it feel tighter" means editing thirty files,
and no variable reaches them.

So: defer the look, not the structure.

## Before the first pages

**Layout primitives.** `Page`, `Section`, `Toolbar`, list and table shells, empty and
error states. Every screen composes from them. Density then lives in four files.

Build them from the bands the spine already names — it lists every screen and its bands,
so there is no need for a separate inventory document. Read the spine.

The states matter as much as the happy path, and the spine lists those too. Empty,
loading, error, over-full: cheapest to build alongside the component, most expensive
retrofitted per page.

**Semantic tokens only.** Never a raw palette value in a product component — always the
semantic token. `bun run check-tokens` fails `bg-red-500`, `text-blue-600`, and hex/rgb
arbitrary values under `apps/*/src`. `packages/ui` is shadcn; do not rewrite overlays
to please the check. A convention nothing enforces lasts about three weeks.

**Then pages.** Primitives before the screens that use them. This ordering is most of the
difference between an app that looks designed and one that looks assembled.

## The visual pass, whenever you want it

Not a phase and not blocking. When the product is usable and you care how it looks:

Edit the token values deliberately — including the ones that already happen to match, so
the file records choices rather than library defaults. Stock components, default radius
and default font are the house style of every generated app; what reads as considered is
a type scale with intent, deliberate density, and one accent used sparingly.

If the composition rules are worth writing down — which colour is the accent and how
rarely it appears, what each type level is for, what this must never look like — put them
in `DESIGN.md` next to the tokens and scope it to the files it governs. Skip it until
something is actually being got wrong repeatedly.

For a single component's shape, use `prototype`: build the variants, look at them, pick.
