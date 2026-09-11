# Parallel jobs

The job is the markdown in this folder. The harness is how you start a sibling
that reads it. Do not copy a job into `.cursor/agents/` or a ChatGPT tab.

Children do not inherit skills. Put `.agents/skills/<name>/SKILL.md` in the
prompt when the job names a skill.

## Start a child

| This harness | Do this |
|---|---|
| **Cursor** | Task tool. `subagent_type` matches `.cursor/agents/<name>.md`. That file pins **Cursor Grok 4.6** and points here. Do not send playbook work to Gemini. |
| **Claude Code** | A subagent or second session. First message: read `.agents/agents/<name>.md`. |
| **Pi** (Herdr pane, or any second process) | New `pi`. First message: read `.agents/agents/<name>.md` and the skill it names. One source. Return; do not write files. |
| **Anything else** | Same prompt in a sibling process. |

If this harness cannot start a sibling, **run the jobs serially in this session**.
Serial is allowed. Skipping because you are not on Cursor is not.

Cursor adapters are extra: model pin, `readonly`, Task discovery. They must not
contain a second copy of the job. Other hosts do not need an adapter file.

## Factory slices

Same spawn table. The prompt is `.agents/skills/build/SKILL.md` plus the slice —
there is no named job per feature. At most five at once, one `src/features/<slug>/`
each. Shared surface (`src/app`, `shared/`, schema, `package.json`) runs alone.
Wave 0 is never parallel with feature slices.
