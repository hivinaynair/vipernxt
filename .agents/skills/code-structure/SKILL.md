---
name: code-structure
description: >-
  Keeps orchestration (why/when) in the feature that owns the journey steps,
  and hoists reusable mechanics (how) to shared/ or a package when a second
  caller appears. Use during build, when two flows duplicate the same
  operation, when deciding actions vs shared code, or when adding a feature
  that shares mechanics with an existing one.
---

# code-structure

Adapted from [michaelshimeles/skills](https://github.com/michaelshimeles/skills)
`code-structure`. Mapped onto this repo's feature folders — not a second
`services/` tree.

## The two layers, here

| Layer | Owns | Lives |
|---|---|---|
| **Orchestration** | Why/when: journey policy, auth, ownership, state transitions, user-facing errors | `apps/*/src/features/<slug>/` — `server/actions/`, `server/queries/`, UI |
| **Mechanics** | How: provider/SDK calls, retries at the wire, payload shaping, health checks | Same feature `lib/` if one caller; `apps/*/src/shared/` if two features in this app; `packages/` if two apps |

**Rule of thumb:** "what this product flow means" stays in the feature.
"how to do this operation reliably" moves only when a second caller exists.

`app/` and `src/proxy.ts` compose. Features never import each other.
`shared/` never imports a feature. `bun run check-boundaries` enforces it.

## When to hoist

- Two features (or two actions in different features) copy the same operational
  block — sandbox create, mail send, webhook verify.
- A bug fixed in one flow does not appear in the other.
- The mechanic has nothing to say about *this* journey step.

**Do not hoist** when the logic is used once, or when it *is* the domain rule
(who may settle, which status comes next). One caller is not a service; it is
a function in that feature.

## Shape of a mechanic

Composable capability blocks, explicit inputs, structured returns. No hidden
globals. Failure is a result, not a swallowed throw.

```ts
// packages/email or shared/server/email.ts — how
export async function sendMail(params: {
  to: string
  subject: string
  html: string
}): Promise<{ id: string }> { /* provider call */ }

// features/onboarding/server/actions/complete-signup.ts — why/when
if (user.marketingOptIn) {
  await sendMail({ to: user.email, subject: "Welcome", html })
}
```

Mechanics do not mutate domain tables. Features load and persist through
`@repo/db` (server-only: Server Components, Server Actions, Route Handlers,
`"use step"`). A package that "just updates `bookings`" is a leaky service.

## Extraction

1. Write the flow in the feature first.
2. Mark the repeated operational chunk.
3. Extract **only** that chunk.
4. Replace one caller → verify (`bun test`, the served step) → replace the rest.
5. Leave policy in the feature.

## Anti-patterns

| Anti-pattern | Here that means |
|---|---|
| God service | `shared/server/app.ts` that runs every workflow |
| Leaky service | A package writes Drizzle rows the feature should own |
| Cross-feature import | `features/a` importing `features/b` to "reuse" an action |
| Over-abstraction | A package for a function one action calls |

`@repo/ui` is components. `@repo/db` is schema and the DB client. Neither is
a dumping ground for product policy.
