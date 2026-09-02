---
name: isolate
description: >-
  Starts every planned slice in its own branch (and a worktree when the harness
  does not already isolate) so agents can build in parallel without colliding.
  Use at the beginning of build, when starting a slice, fix, or task, or when
  the user says isolate, worktree, or new-feature. Not for shaping.
---

# isolate

Adapted from [michaelshimeles/skills](https://github.com/michaelshimeles/skills)
`new-feature`. Every slice gets its own checkout. Never build on `main`.

`/next` → `build` invokes this. They do not type `/isolate`.

## Harness deltas — read first

- **Claude Code**: the harness already creates worktrees under
  `.claude/worktrees/`. Keep that branch. Skip the `git worktree add` step.
- **Cursor-managed worktrees** (branch names `worktree-*`, or a Cloud Agent
  checkout): keep the assigned branch and directory. Skip creating another
  worktree.
- Any other harness: follow every step.

Steps 1–2 still run on every host.

## Do

1. **Sync.** `git fetch origin`.

2. **Scope check.** List open PRs and their files (`gh pr list`,
   `gh pr diff --name-only`). If this slice needs a file another open PR is
   editing, **stop** — that is a `decide` for them, not a merge you invent.
   Also refuse a dirty checkout that is not yours.

3. **Name.** Lowercase-with-hyphens plus a short unique suffix, preferably
   the slice id: `f2-1-reconciliation`. If the name exists, pick another —
   never force or reuse.

4. **Worktree** (only when the harness did not already isolate), from the
   repo root:

   ```sh
   git worktree add .worktrees/<task-name> \
     -b <task-name> origin/staging
   ```

   Branch from **`origin/staging`** (the check-in branch). `main` is
   production. Use a gitignored directory (`.worktrees/` or the harness
   default) so worktrees cannot be committed.

5. **Enter and verify.**

   ```sh
   cd .worktrees/<task-name>   # or stay put if the harness owns the tree
   git branch --show-current   # must not print main
   bun install
   ```

   Confirm Bun `1.4.x` before running anything. Worktrees do not share
   `node_modules`.

## Remember

- Worktrees do **not** isolate ports, Neon branches, or lockfiles. Confirm a
  dev-server port answers *this* process before trusting it. Resolve lockfile
  conflicts by regenerating (`bun install`), never by hand-merging. Do not
  run schema experiments against a shared database.
- Keep the worktree until the PR is merged or closed. Then:

  ```sh
  git worktree remove .worktrees/<task-name>
  git branch -D <task-name>
  ```

  `-D` is expected after a squash merge.

## Do not

- Reuse another agent's worktree, branch, or uncommitted work.
- Force-push to `main` or `staging`. `--force-with-lease` only on this
  slice's branch.
- Create a worktree because a Cloud or Claude session already gave you one.
