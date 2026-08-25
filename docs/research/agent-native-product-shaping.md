# Gathering context before building a SaaS v1, in the agent era

Date: 2026-08-25
Question: with agents writing most of the code, what is the best way to gather and
structure everything you need *before* building v1 — and can it be packaged as a
reusable playbook of skills and tools?

Sources are linked inline. Where a claim is contested, both sides are recorded.

---

## 1. The consensus: the spec is the leveraged artifact

Spec-driven development (SDD) went mainstream in 2026 on a simple premise: agents are
good at writing code and bad at guessing intent, so the written spec — not the code —
is the highest-leverage thing a human produces.

The academic framing ([arXiv 2602.00180](https://arxiv.org/html/2602.00180v1)) is the
most useful part of the literature, because it separates three levels of rigor that get
conflated everywhere else:

| Level | Meaning | Cost |
|---|---|---|
| **Spec-first** | Spec guides initial build, may drift after | Cheap; fine for v1 |
| **Spec-anchored** | Spec is living, kept true by automated tests | Real ongoing cost |
| **Spec-as-source** | Code is generated; humans only edit specs | High; rare in practice |

The paper reports human-refined specs improving LLM-generated code quality with "error
reductions of up to 50%" in controlled studies, while conceding the empirical base is
nascent. Its five named failure modes are worth memorising: over-specification (specs
become pseudo-code), specification rot, bureaucratic overhead, tooling complexity, and
false confidence from passing spec tests.

### The pipeline everyone converged on

[GitHub Spec Kit](https://github.com/github/spec-kit) is the clearest expression:
`constitution` (governing principles) → `specify` (what and why, no tech) → `clarify`
(close underspecified areas) → `plan` (tech) → `tasks` → `implement`, plus `analyze`
for cross-artifact consistency and `converge` to reconcile drift back into tasks.

[AWS Kiro](https://kiro.dev/docs/specs/feature-specs/) compresses this into three files
per feature: `requirements.md` (EARS notation), `design.md` (architecture, sequence
diagrams, non-functionals), `tasks.md` (sequenced work). It supports both
requirements-first and design-first ordering — design-first when architecture constrains
scope.

### EARS

[EARS](https://en.wikipedia.org/wiki/Easy_Approach_to_Requirements_Syntax) is a sentence
template, not a framework: **WHEN** \[condition\] **THE SYSTEM SHALL** \[behavior\]. It
is what Kiro generates, and its value is that each line converts directly into a test
case. It is the rigorous cousin of Gherkin's Given/When/Then.

## 2. The counter-evidence: specs rot, and this has failed before

Not optional reading. The critique ([TDD Buddy](https://www.tddbuddy.com/blog/spec-driven-is-the-drift-trap/))
is that the industry has run this play roughly every decade and lost: Gherkin feature
files became a veneer over step definitions the business could not read and engineers had
to maintain; the layers drifted; teams quietly shelved them. Wiki design docs got updated
exactly once, at project start — because after that, changing the code was faster than
routing a doc through review.

The sharper version: **the spec is never the finished thing to build on; it is the thing
that is perpetually repaired.** Building always teaches you something you did not know
when you wrote the spec.

Design consequence: the only specs that survive are the ones something automated reads.
A journey file that nothing consumes is a wiki page with extra steps.

## 3. Journeys as a first-class artifact

Four options, in ascending order of machine-usefulness:

**Mermaid `journey` diagrams** ([syntax](https://mermaid.js.org/syntax/userJourney.html))
— steps with actors and 1–5 satisfaction scores. Renders natively in GitHub and in
Claude artifacts. Good for human legibility, weak as a data model: no IDs, no state, no
branching.

**User story mapping** (Jeff Patton) — the *backbone* is the left-to-right narrative of
high-level user activities; stories hang beneath each. The **walking skeleton** is the
thinnest horizontal slice that still delivers a complete end-to-end experience. This is
the discipline that turns a journey into a v1 scope decision, and it maps almost exactly
onto the "clip" concept already in this repo's `shaping-saas` skill.

**W3C User Journey Graph (UJG)** — a
[community group](https://www.w3.org/groups/cg/ujg/) chaired by Seva Dolgopolov, defining
"an interoperable, machine-readable representation of user journeys" so design, PM and
engineering share one source of truth. Model covers journeys, states, transitions,
nesting, reusable navigation patterns, plus a runtime model for recording actual user
behavior as causally ordered event chains. Editor's drafts at
[ujg.specs.openuji.org](https://ujg.specs.openuji.org/), repo at
[openuji/spec-ujg](https://github.com/openuji/spec-ujg). **Status: editor's draft, not
stable.** Worth tracking and worth stealing the shape of; too early to depend on.

**Gherkin / EARS** — the executable leaf. One journey step expands into N acceptance
criteria that become tests. Note the warning from
[Automation Panda](https://automationpanda.com/2026/04/27/bdd-gherkin-guidelines-for-ai-coding-and-testing/):
without explicit rules, agent-written Gherkin drifts into vague Then steps, UI-heavy
scripts, multi-behavior scenarios, and placeholder examples.

**The synthesis** — nobody ships a standard that connects these. The practical move is a
journey file with **stable IDs** at each level, where the ID is what ties a journey step
to a screen, a route, a test name, and a task. Traceability is the anti-rot mechanism:
rename a journey step and the test that names it fails loudly.

## 4. Supplying context to the agents

**AGENTS.md** ([agents.md](https://agents.md/)) — open format, plain Markdown, no required
fields, adopted by 60,000+ open-source projects and read by Codex, Jules, Gemini CLI,
Claude, Copilot coding agent, Cursor, Zed, Warp, Aider, Devin, Factory. This is the
portable layer; `CLAUDE.md` is the Claude-specific one.

**Agent Skills** ([Anthropic engineering](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills),
[platform docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview))
— progressive disclosure is the core idea: SKILL.md is a table of contents, detail lives
in files loaded only when needed. Guidance worth applying: keep SKILL.md under ~500 lines;
prefer scripts over instructions for deterministic work ("scripts let Claude spend its
turns on composition instead of reconstruction"); keep skills **passive and composable** —
no sequencing logic that welds a skill to one workflow; build them evaluation-driven, from
observed capability gaps.

**MCP for first-party context** — [Figma Dev Mode MCP](https://www.figma.com/blog/introducing-figma-mcp-server/)
gives agents components, variables, and Code Connect mappings instead of screenshots, and
now supports write (creating components and screens from an existing library). Playwright
MCP drives a real browser for verification. These replace "describe the design in prose"
with structured data.

**Context engineering** ([Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents))
— just-in-time retrieval via lightweight identifiers rather than pre-loading; compaction,
structured note-taking, and sub-agent architectures for long-horizon work. Relevant here:
a shaping session *is* long-horizon, and the durable artifact on disk is the structured
note.

## 5. Packaging the playbook

[Claude Code plugins](https://code.claude.com/docs/en/plugins) bundle exactly the pieces a
playbook needs, in one versioned, installable unit:

| Directory | Holds |
|---|---|
| `skills/` | `<name>/SKILL.md` — the procedures |
| `agents/` | subagent definitions |
| `hooks/hooks.json` | event handlers (lint, validate, gate) |
| `.mcp.json` | MCP servers the playbook assumes |
| `commands/` | flat-file slash commands (legacy; prefer `skills/`) |
| `settings.json` | default settings when enabled |

Distribution is a marketplace — a git repo, which may be **private** for team-internal
playbooks. `claude plugin validate ./your-plugin` runs the same check the community review
pipeline runs. Skills in a plugin are namespaced (`/plugin-name:skill-name`). The docs'
own advice: start standalone in `.claude/`, convert to a plugin when you want to share it
across projects.

This matters for ViperNxt specifically: skills currently live in `.agents/skills/` with
`.claude/skills/` symlinks, which works for *this clone* but does not travel to the next
product. A plugin does.

## 6. Implications for this repo

1. `shaping-saas` already implements the front of the SDD pipeline (interview → research →
   claim → actors → journeys → screens → doc) and already made the doc the durable state.
   What it lacks is the **downstream half**: journey → acceptance criteria → tasks, with
   IDs that survive into tests.
2. The design doc is currently one file per product. Spec Kit and Kiro are both **per
   feature**. A v1 needs both altitudes: one product doc, then one spec per feature.
3. Nothing in the repo yet turns a confirmed journey into anything automated. Until
   something reads the journeys, section 2's rot warning applies in full.
4. Skills should be split by altitude and kept passive, per Anthropic's composability
   guidance — one skill per phase, invocable independently, rather than one monolith that
   owns the whole sequence.
