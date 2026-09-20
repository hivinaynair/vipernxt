---
name: before-and-after
description: Captures before/after screenshots of web pages or elements for visual comparison. Use when user says "take before and after", "screenshot comparison", "visual diff", "PR screenshots", "compare old and new", or needs to document UI changes. Accepts two URLs (file://, http://, https://) or two image paths.
allowed-tools:
  - Bash(bunx @vercel/before-and-after *)
  - Bash(before-and-after *)
  - Bash(which before-and-after)
  - Bash(bunx @vercel/before-and-after@latest *)
  - Bash(*/upload-and-copy.sh *)
  - Bash(curl -s -o /dev/null -w *)
  - Bash(gh pr view *)
  - Bash(gh pr edit *)
  - Bash(vercel inspect *)
  - Bash(vercel whoami)
  - Bash(which vercel)
  - Bash(which gh)
---

# Compare the same state before and after

Vendored from [vercel-labs/before-and-after](https://github.com/vercel-labs/before-and-after) via [michaelshimeles/skills](https://github.com/michaelshimeles/skills). Use `@vercel/before-and-after`, not the similarly named package.

Establish both URLs/images from the task or verified deployment context. Ask only for a missing baseline. Do not switch branches/stash/start servers merely to invent one. Use identical seed, frozen date, viewport and authentication state. Never assume a preview-login route exists.

Preflight: `which before-and-after` or `bunx @vercel/before-and-after@latest --help`. For protected deployments, use existing authorized test access; never disable protection or expose bypass secrets in artifacts.

```sh
bunx @vercel/before-and-after <before-url> <after-url>
# Optional: selector(s), --mobile, --tablet, --size WxH
```

Use full scroll capture only when requested. Existing image pairs are also supported. Read installed help for capture/output flags. Do not use automatic upload flags that send captures to the public 0x0.st default. Local PNGs are the default deliverable; inspect both before returning.

Only upload or edit a PR when authorized for that destination. The bundled uploader lives at `.agents/skills/before-and-after/scripts/upload-and-copy.sh`; choose an explicitly permitted adapter/destination rather than its default. A gist is not automatically appropriate for sensitive customer data. Use a body file for PR markdown; preserve existing content.

Report what changed and any inaccessible state. Different data or missing authentication is a comparison limitation, not a passing visual test.
