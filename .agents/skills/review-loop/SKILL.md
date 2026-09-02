---
name: review-loop
description: >-
  After a draft PR exists, iterates on automated review comments until the
  reviewer is clean or the cap is hit. Use at the end of build when shipping
  a slice, or when the user says greploop, greptile, or review loop. Skip
  entirely when Greptile (or an equivalent bot) is not installed on the repo.
---

# review-loop

Adapted from [michaelshimeles/skills](https://github.com/michaelshimeles/skills)
`greploop` / `greploop-apps`. Optional. The merge bar is the gate; this is
polish on top.

`/next` → `build` invokes this after the draft PR is open. They do not type
`/greploop`.

## Detect, then maybe skip

Greptile is **not** a ViperNxt vendor. Do not add it. Do not hold a `decide`
to install it.

Skip (one line in the PR: "no review bot on this repo") when none of these
are true:

- A check run whose name matches `/greptile/i` has appeared on recent PRs
- They asked for Greptile by name
- `.greptile/` or a Greptile GitHub App is visibly installed

This repo is GitHub. Do not implement GitLab or Perforce paths.

## Loop (max 5)

1. Push the slice branch if needed.
2. If a Greptile check is not already `PENDING`/`IN_PROGRESS`, comment
   `@greptile review`. If that returns "Too many files changed", comment
   `@greptile-apps review` instead and poll the bot's edited summary
   comment when no check run appears.
3. Wait until the check (or the summary comment's `updated_at`) completes.
   Cap the wait at ~10 minutes; then stop and report the timeout.
4. Read the latest Greptile summary **and** unresolved inline threads.
   Parse confidence (`n/5`) and open comments.
5. **Exit** if confidence is 5/5 and zero unresolved comments, or if this
   was the fifth iteration.
6. Fix actionable comments. Informational or false-positive: note why, still
   resolve the thread. Do not widen the slice. Do not rewrite EARS.
7. Resolve addressed threads (GitHub GraphQL `resolveReviewThread`).
8. Commit `address review feedback (iteration N)`, push
   (`--force-with-lease` only on this branch), go to 2.

## Do not

- Merge. They merge, or they don't.
- Loop on CI that is not a review bot (Biome, types, journeys). Fix those
  in `build` before this skill runs.
- Let a review comment expand the contract. That is a `decide` via `/next`.

## Report

```
Review loop complete.
  Iterations:  2
  Confidence:  5/5
  Remaining:   0
```

If the cap hit, list what is still open. The PR can still be the hand-off.
