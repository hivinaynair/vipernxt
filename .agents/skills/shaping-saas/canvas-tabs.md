# Canvas tabs

The canvas is a **view** of `docs/plans/YYYY-MM-DD-<name>-design.md`. If they disagree with the canvas, change the doc first.

## When this applies

Only on a host with the Cursor canvas skill installed. If `~/.cursor/skills-cursor/canvas/SKILL.md` is missing, skip step 9 entirely — do not substitute another artifact. Nothing downstream depends on the canvas existing.

## Before writing

1. Read `~/.cursor/skills-cursor/canvas/SKILL.md`.
2. Read `~/.cursor/skills-cursor/canvas/sdk/index.d.ts` if you need exact exports.
3. Do not `mkdir` the canvases folder. Write the file directly.

## Path

```
/Users/<user>/.cursor/projects/<workspace>/canvases/<name>-design.canvas.tsx
```

`<name>` = kebab-case product name (same slug as the design doc). Preserve acronym capitalization; lowercase the rest.

Find `<workspace>` from paths already in the environment; if you cannot, list `~/.cursor/projects/` — do not guess.

Exactly one `.canvas.tsx` per canvas. No helper files. Import **only** from `cursor/canvas`. Default-export the page component. Embed data inline (no `fetch`).

## Tabs

Use `useCanvasState` + `Pill` for tabs. **Omit a tab until that gate is confirmed** (no empty states, no “TODO”).

| `id` | Label | When it appears | Content |
|---|---|---|---|
| `claim` | Claim / clip | Claim confirmed | One-paragraph claim. Optional horizontal DAG of clip beats (`computeDAGLayout` + SVG using **theme** stroke/fill). Table of clip steps. `Callout` for the public vs private line if any. |
| `actors` | Actors | Actors confirmed | `Grid` of `Card`s: name, type pill, what they do, what they never do. Mark the default seat with `Pill active`. |
| `journeys` | Journeys | Journeys confirmed | One-URL reminder. Journey `Table` (seat, wants, clicks, after beat 1, at the end). `Callout` for who must not get the dangerous control. |
| `screens` | Screens | Screens confirmed | Bands as a `Table` (band / what sits there). Per-seat copy in a `Grid` of cards. Layout bands + copy only. |
| `stack` | Stack | Stack recorded | What we use vs skip (`Table`). Optional DAG of major pieces. Cite research links in `Text`, not as a dump. |

Optional extra tab **only if the doc has a real invariants section**: `invariants` (“What is public”). Do not add decorative tabs.

## Shell

```tsx
import {
  Callout,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Stack,
  Table,
  Text,
  computeDAGLayout,
  useCanvasState,
  useHostTheme,
} from "cursor/canvas";

type Tab = "claim" | "actors" | "journeys" | "screens" | "stack";

export default function ProductDesign() {
  const [tab, setTab] = useCanvasState<Tab>("tab", "claim");
  // Header: H1 + secondary one-liner from the claim.
  // Row of Pills. Switch body on tab.
  // Divider + small tertiary caption: Source: docs/plans/YYYY-MM-DD-<name>-design.md
}
```

## Design rules (canvas skill)

- Colors from `useHostTheme()` only. **No hardcoded hex.**
- No gradients, no emoji, no box-shadows, no rainbow coloring.
- Mix open sections with cards; do not wrap every block in the same card.
- SVG node fills: `theme.bg.elevated` / `theme.fill.tertiary`; strokes: `theme.stroke.primary` / `secondary`; text: `theme.text.primary`.
- Caption must name the design doc so the canvas is not a second source of truth.

## Chat

When you mention the canvas, always include a markdown link to the **absolute** `.canvas.tsx` path. Tell them they can open it beside the chat. If this workspace has no other canvas yet, one sentence: a canvas is a live view beside the chat, not the spec.
