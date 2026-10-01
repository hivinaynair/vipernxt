---
name: design-system
description: Build shared layout primitives and semantic tokens before product screens.
---

# design-system

Input: approved screen bands/states. Output: needed Page/Panel/Toolbar/list/table shells and empty/loading/error states before screens. Shared primitives own adjustable density; follow shared-surface serialization.

Use semantic tokens; `bun run check-tokens` rejects raw palettes/colors in product sources. Tokens belong in UI styles, not rewritten vendor components.

For requested visual work, choose typography, spacing and restrained accents deliberately. Keep useful composition rules in a one-page DESIGN.md. Use prototype only for material unresolved interactions/layout. Return evidence to /next.
