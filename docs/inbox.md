# Where to put your stuff

You are asked for real-world material twice. There is a folder for each, and a
script that makes what you drop in readable by an agent.

## 1. Anything that already exists → `docs/research/salvage-inbox/`

Scribbled notes, a spreadsheet, screenshots of the old software, photographs of
a register, a wireframe, an exported CSV, an email thread.

**Do not rename anything. Any format is fine.**

```bash
bun scripts/salvage-inbox.mjs docs/research/salvage-inbox
```

Copies originals to `raw/`, writes readable JPEGs to `pages/`, and generates an
`INVENTORY.md` with a line per page for you to caption. It exists because an
iPhone photo is HEIC — which an agent cannot open at all — and a 4K screenshot
is too large to read. Sideways text: re-run with `--rotate 90`.

**Cloud:** a Cloud Agent cannot see that folder. Prefer running the command on a
laptop and sending only `INVENTORY.md` plus the `.transcript.md` files. If
originals must travel, attach **one zip** — not forty photos, not a Drive link.

> `raw/` and the page JPEGs are gitignored. Photographs of a register hold real
> names and are not going into version control — especially not from a cloud
> agent PR.

### What is worth digging out

| Bring | Why |
|---|---|
| A **filled-in** form or receipt — not a blank one | Blank gives field names. Filled gives which fields everyone leaves empty, and what gets written in the margin |
| The spreadsheet as **CSV**, not a screenshot | A screenshot of a spreadsheet is the worst of both |
| Screenshots of the old software — including the ugly screens | Vocabulary, dropdown states, error text |
| Anything **taped to a wall** or clipped to the counter, and anything laminated | Where the workarounds live. A handwritten code sheet stuck to a monitor is staff telling you exactly where the software fails them |
| Anything printed that gets handed to a customer | Legal requirements nobody thinks to mention |
| The last ten real cases (or a week of the job) | This becomes the eval set. Wave 0 seeds it |

"We don't have that" is a real answer — the absence is itself a finding. Say it
rather than leaving a blank.

## 2. What comes back from the field → `docs/product/intake/`

`field-kit` writes your homework to `docs/product/homework/` and renders it as a
Word document you can type into on site:

```bash
bun scripts/homework.mjs build docs/product/homework/02-site-visit.md
```

Fill it in, drop the filled copy into `docs/product/intake/`, and it is read
back:

```bash
bun scripts/homework.mjs read docs/product/intake/02-site-visit.docx
```

Formatting is not your job — messy is fine. Photographs you took go through
`salvage-inbox.mjs` first, same as everything else.
