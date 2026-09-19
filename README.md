# ViperNxt

**Turn a validated problem into a working MVP—with requirements first and cloud agents doing the implementation.**

ViperNxt is a SaaS starter and an agent workflow for solo developers. Start with
`/next` and describe what you want to build. It researches the problem, helps you
validate it with real people, and works through the journeys, screens, form
fields and permissions before writing product code. You review the first working
slice; the factory then builds and verifies the remaining approved work.

**The flow:** idea → research → requirements → first working slice → your review → MVP.

## Get started

Create your own repository from this template, then clone it and run:

```bash
bun install
```

Open it in an agent editor that supports repository skills, such as Cursor or
Claude Code, and type:

```text
/next I want to build [idea] for [people]. Today they solve it by [workflow].
```

Use `/next` again to continue; it reads the saved project state. `/status` shows
where you are and what needs your input. Requires [Bun](https://bun.sh) 1.4.x.

You can start with an idea, but implementation waits for evidence that another
person has the problem. Research may conclude that improving an existing tool—or
not building—is the better answer.

## What happens next?

| Stage | What you get |
|---|---|
| Understand | Research on existing solutions, questions and homework for real users |
| Shape | Agreed scope, user journeys, screens, fields, table columns and access rules |
| Plan | Small implementation slices mapped to every MVP requirement, with dependencies |
| First slice | One working journey for you to try before the rest is built |
| Factory | Cloud implementation, independent reviews and integrated verification |
| Acceptance | Verification of the staging deployment against the approved requirements |

Authentication, tenant boundaries, persistence and shared navigation are planned
early. The coverage check rejects missing requirements; completing a list of
tickets alone does not count as completing the MVP.

## What runs where?

- **Your editor:** `/next` handles discovery, shaping and the implementation handoff.
- **Vercel:** the Eve factory coordinates approved batches from GitHub Issues,
  enforces execution limits and tracks verification.
- **Cursor Cloud:** agents implement slices and independently check the result.
- **You:** supply real-world evidence, approve the design and review the first slice.

Cloud execution needs a dedicated product repository, Cursor API access and the
factory configuration. `/next` guides setup; `bun install` alone does not connect
these services.

**Status:** the hosted factory is experimental. Automated checks pass, but the
complete live delivery loop and Clerk cloud sign-in still need end-to-end proof.
See the [Eve setup and limits](deploy/eve/README.md).

## The stack

| Purpose | Tools |
|---|---|
| Application | Next.js App Router, TypeScript, Bun, Turborepo |
| UI | shadcn/ui in `packages/ui` |
| Authentication | Clerk |
| Database | Drizzle + Neon; PGlite for local development |
| Background work | Vercel Workflows |
| Analytics, email, files | PostHog, Resend, Vercel Blob |
| Quality | Biome, Bun tests, Playwright |

The [recipe](docs/kit/recipe.yaml) scaffolds only the surfaces and services the
product needs. When auth is selected, setup can create or reuse a Clerk application
and scaffold Playwright sign-in helpers. Cloud verification uses dedicated
development users and runtime secrets—see [Clerk setup and testing](docs/kit/cloud-auth.md).

## Working in the repository

```bash
bun run dev                 # after scaffolding the application
bun run check-types
bun run check-boundaries
bun run check-tokens
bun run check-journeys
bun test
```

Branch from `staging` and open PRs into `staging`; `main` is production.
Database scaffolding generates the migration workflow. The bare kit has no active
migration workflow.

Keep product work in your own clone. Customer files, credentials and product state
do not belong in this template.

## Read more

- [The discovery-to-delivery workflow](docs/playbook/fde-loop.md)
- [Eve factory setup](deploy/eve/README.md)
- [MVP coverage and acceptance contract](deploy/eve/COVERAGE.md)
- [Repository map](docs/map.md)
- [Agent development rules](AGENTS.md)
