---
name: before-and-after
description: Capture comparable before/after screenshots using identical data, viewport and authentication.
---

# before-and-after

Adapted from [before-and-after](https://github.com/vercel-labs/before-and-after) via [michaelshimeles/skills](https://github.com/michaelshimeles/skills); retain LICENSE.

Establish both URLs/images from verified context. Ask only for a missing baseline; don't stash/switch branches/start unrelated servers to invent one. Match seed, frozen date, viewport and authentication. Never assume a preview-login route or disable protection.

```sh
bunx @vercel/before-and-after --help
bunx @vercel/before-and-after <before-url> <after-url>
```

Read installed help for selector/device/output flags. Full scroll only when requested. Inspect both local PNGs. Avoid public automatic upload flags; publishing requires an authorized destination. PR edits preserve existing body using a body file.

Report visible changes and inaccessible states; mismatched data/auth is a limitation, not a passing comparison.
