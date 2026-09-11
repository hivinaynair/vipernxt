# Reading a pile

Loaded by [SKILL.md](SKILL.md) when the prior art is not a repository — which is
most of the time. Skip it when there is nothing but code to read.

Most of the time there is no repo. There is a folder of photographs, a spreadsheet
someone exported, screenshots of a desktop application, a wireframe drawn last month.

**Ask for the pile before reading anything, and ask physically.** "Send me anything you
have" returns nothing. A checklist returns a folder:

> Drop whatever already exists into `docs/research/salvage-inbox/` — any format, don't
> rename anything:
>
> - [ ] Photos of whatever they use today — the spreadsheet on screen, the register, the whiteboard
> - [ ] One **filled-in** copy of every form or receipt — filled in, not blank
> - [ ] The spreadsheet itself as CSV, if it can be exported
> - [ ] Screenshots of the old software — every screen, including the ugly ones
> - [ ] Anything printed that gets handed to a customer
> - [ ] **Anything taped to a wall or clipped to the counter**, and anything laminated
> - [ ] Wireframes or sketches, if any exist
>
> Say "nothing" for any line that genuinely does not exist — that is a finding too.

The filled-in copy matters more than the blank one: a blank form gives you field names, a
filled one gives you which fields are always empty, what people write in the margin, and
which "required" field everyone skips. The wall and the lamination matter because that is
where the workarounds live — a handwritten code sheet clipped to a monitor is the counter
staff telling you exactly where the software fails them.

That request is one held item, `kind: gather`, done when every row of the inventory has a
caption. Do not start mining a half-empty inbox.

**Normalise before reading.** Run `scripts/salvage-inbox.mjs <files...>`. It copies
originals to `raw/`, writes readable JPEGs to `pages/`, and emits `INVENTORY.md`. This is
not tidiness: an iPhone photo is HEIC, which cannot be read at all, and a 4K screenshot
exceeds the size limit — and an unreadable image can break the whole session rather than
failing on that one file. Look at one page afterwards; if the text runs sideways, re-run
with `--rotate 90`. Photographs of screens and walls are usually sideways with nothing in
the file to say so.

**Ask for text wherever text exists** — the spreadsheet as CSV, the thread as `.eml`, the
document as itself. A screenshot of a spreadsheet is the worst of both.

**Transcribe before claiming.** An image cannot be cited by line. Before any fact is
drawn from a photograph, write `pages/<name>.transcript.md`: field names exactly as
written, in the original language, untranslated, including the crossings-out and the
margin notes. Facts then cite `receipt-03.jpg → transcript line 7`, and the pile stays
greppable for every phase after this one.

**Read each type for what it actually holds:**

| Artifact | Mine for | Do not take |
|---|---|---|
| Photo of a form, receipt, register | Field list, verbatim, with the handwriting | Its layout |
| Spreadsheet | Column names, formulas, validation lists, which columns are empty | Its tabs and sheet split |
| Screenshot of the incumbent | Vocabulary, states in dropdowns, error text | Navigation, page set |
| Wireframe or mockup | Almost nothing — it is pure structure | All of it |
| Diagram (flow, org, ER) | Entities, states, transitions, handoffs | The grouping of boxes |
| Chat and email threads | Exceptions, edge cases, the argument about what a word means | — |

The wireframe row is not a joke. A wireframe someone drew last month is the highest-
temptation, lowest-fact object in the pile, and it is usually their own — which makes the
facts/structure rule harder to hold, not easier.

**What is missing is a finding.** "No photograph of what the customer walks away with"
goes to `field-kit` as an open question. Never quietly fill the gap.

**Keep `raw/` out of version control.** Photographs of a register hold real names.
