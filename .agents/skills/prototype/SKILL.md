---
name: prototype
description: >-
  Builds three genuinely different versions of one component behind a picker, so a
  design question gets answered by looking instead of arguing. Use during build
  when a component's layout, density, or interaction model is undecided, or when
  the user dislikes how something feels and cannot say why.
---

# Compare one component decision

Adapted from [emilkowalski/skills](https://github.com/emilkowalski/skills/blob/main/skills/prototype/SKILL.md). Use only when a material layout/interaction choice remains unresolved; routine components do not require variants.

Establish one component brief from existing context. Read tokens, surrounding UI and DESIGN.md. Name the axis before building: layout, density, motion or interaction. Default three genuinely different, defensible versions; not three colors of the same idea.

Use realistic content and working interactions. Motion respects reduced-motion and is ordinarily under 300ms. Render full size in context behind an instant unanimated picker. Keep experiments separate from production behavior; during build use an isolated prototype route with shared-surface ownership, or a standalone artifact outside gated product paths.

Present tradeoffs without a taste recommendation. After selection, integrate the chosen version and delete the experimental route/files. Record the decision and axis; return to the caller. Product scope changes still go through `/next`.
