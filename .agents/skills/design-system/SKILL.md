---
name: design-system
description: >-
  The two rules that must hold before pages get written — layout primitives so
  density is changeable, and semantic tokens only — plus what a later visual pass
  can and cannot fix. Use before the first screens are built, or when the app
  looks inconsistent.
---

# Structure before screens

Input: accepted screen bands/states. Output: the smallest shared layout primitives plus semantic tokens, before the first product screen. Palette refinement may happen later; structure cannot cheaply be retrofitted.

Build Page, Section/Panel, Toolbar/list/table shells and empty/loading/error states only as needed. Screen density should be adjustable in these shared primitives, not repeated spacing decisions across pages. Respect the repo's shared-surface ownership rule.

Use semantic tokens in product components. `bun run check-tokens` rejects raw palette utilities and raw color arbitrary values under apps. Tokens live in the UI styles; do not rewrite shadcn overlays to satisfy a product-source check.

Choose typography, spacing and one restrained accent deliberately when a visual pass is requested. Put genuinely useful composition rules in a one-page DESIGN.md; do not document defaults for ceremony. Use `prototype` only for a material component interaction/layout question. Return implementation/evidence to `/next`.
