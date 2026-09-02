#!/usr/bin/env node
// Turns a field-research homework file into a .docx someone can actually type into,
// and reads the filled copy back out as markdown.
//
//   node scripts/homework.mjs build docs/product/homework/02-temple-visit.md
//   node scripts/homework.mjs read  ~/Downloads/02-temple-visit.docx
//
// The markdown stays the source of truth. The .docx is a render of it, so the homework
// is edited in one place and never diverges from the file state.yaml points at.
//
// Conventions the renderer relies on — keep homework written this way:
//   ## Stage 2 — the counter clerk   section, starts a new page, numbered "Section 2 of 8"
//   ### What to ask                  sub-heading
//   - Walk me through yesterday      question, gets a numbered box
//     Why we ask: ...                indented under a question — a note, not a question
//   - [ ] Photograph every screen    thing to capture, gets a tick box
//   Anything else                    instruction; no box, nobody has to fill it
//
// Layout follows Dillman's principles for self-administered questionnaires
// (Internet, Mail and Mixed-Mode Surveys, 2009): questions on a lightly shaded
// field with the answer space in white beneath (#16, #17 — white answer spaces
// measurably reduce item non-response), dark print for questions and light for
// instructions (#12), consecutive numbering (#9), instructions placed exactly
// where they are needed rather than in a preamble (#2), more space between
// questions than within one (#11), and 12pt body text, which is his minimum for
// older respondents.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";

const [cmd, target, ...rest] = process.argv.slice(2);
if (!cmd || !target) {
  console.error("usage: homework.mjs build <homework.md> [--out <file.docx>]");
  console.error("       homework.mjs read  <filled.docx> [--out <file.md>]");
  process.exit(1);
}
const outFlag = rest.indexOf("--out");
const outArg = outFlag === -1 ? null : resolve(rest[outFlag + 1]);

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Markdown emphasis is noise in a form. Strip it rather than rendering it.
const plain = (s) =>
  s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .trim();

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

const FONT = '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Arial"/>';

const run = (text, { size = 24, bold = false, italic = false, color = null } = {}) =>
  `<w:r><w:rPr>${FONT}${bold ? "<w:b/>" : ""}${italic ? "<w:i/>" : ""}` +
  `${color ? `<w:color w:val="${color}"/>` : ""}<w:sz w:val="${size}"/></w:rPr>` +
  `<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;

const para = (
  text,
  {
    size = 24,
    bold = false,
    italic = false,
    color = null,
    before = 0,
    after = 80,
    pageBreak = false,
    shade = null,
  } = {},
) =>
  "<w:p><w:pPr>" +
  (pageBreak ? "<w:pageBreakBefore/>" : "") +
  (shade ? `<w:shd w:val="clear" w:fill="${shade}"/>` : "") +
  `<w:spacing w:before="${before}" w:after="${after}"/></w:pPr>` +
  (text ? run(text, { size, bold, italic, color }) : "") +
  "</w:p>";

const borders = (color) =>
  "<w:tblBorders>" +
  ["top", "left", "bottom", "right", "insideH", "insideV"]
    .map((e) => `<w:${e} w:val="single" w:sz="4" w:space="0" w:color="${color}"/>`)
    .join("") +
  "</w:tblBorders>";

// One question is one table: a shaded cell carrying the number, the question and
// any note, then a white cell to answer in. Stacked rather than side by side so a
// long question does not wrap into a column two words wide, and so the answer
// space is the full width of the page whether it is typed into or written on.
// The white box is deliberately taller than one line: a larger answer space
// produces longer answers (Christian & Dillman 2004), and it has to hold
// handwriting if this gets printed.
const CONTENT_WIDTH = 9638; // A4 minus the 1134-twip margins on each side

const tableProps = (fill) =>
  "<w:tblPr>" +
  `<w:tblW w:w="${CONTENT_WIDTH}" w:type="dxa"/>` +
  '<w:tblLayout w:type="fixed"/>' +
  borders(fill) +
  '<w:tblCellMar><w:top w:w="120" w:type="dxa"/><w:left w:w="160" w:type="dxa"/>' +
  '<w:bottom w:w="120" w:type="dxa"/><w:right w:w="160" w:type="dxa"/></w:tblCellMar>' +
  "</w:tblPr>";

// A band, not a shaded paragraph — paragraph shading does not reliably fill the
// line, so a one-cell table is what actually reads as a section divider.
const sectionBand = (label, title) =>
  "<w:tbl>" +
  tableProps("D0D0D0") +
  '<w:tr><w:tc><w:tcPr><w:tcW w:w="' +
  CONTENT_WIDTH +
  '" w:type="dxa"/>' +
  '<w:shd w:val="clear" w:fill="DCE6F0"/></w:tcPr>' +
  para(label, { size: 18, color: "5A6B7B", after: 20 }) +
  para(title, { size: 30, bold: true, after: 0 }) +
  "</w:tc></w:tr></w:tbl>" +
  para("", { size: 16, after: 0 });

// One question is one table: a shaded cell carrying the number and the question,
// then a white cell to answer in. Stacked rather than side by side so a long
// question does not wrap into a column two words wide, and so the answer space is
// the full width of the page whether it is typed into or written on. The white box
// is deliberately tall: a larger answer space produces longer answers (Christian &
// Dillman 2004), and it has to hold handwriting if this gets printed.
const questionBlock = (n, total, question, note, tick) =>
  "<w:tbl>" +
  tableProps("BFBFBF") +
  "<w:tr><w:trPr><w:cantSplit/></w:trPr><w:tc>" +
  `<w:tcPr><w:tcW w:w="${CONTENT_WIDTH}" w:type="dxa"/><w:shd w:val="clear" w:fill="EFEFEF"/></w:tcPr>` +
  para(`Question ${n} of ${total}`, { size: 17, color: "6E6E6E", after: 30 }) +
  para((tick ? "\u2610  " : "") + question, { size: 24, bold: true, after: note ? 30 : 0 }) +
  (note ? para(note, { size: 21, italic: true, color: "4A4A4A", after: 0 }) : "") +
  "</w:tc></w:tr>" +
  '<w:tr><w:trPr><w:trHeight w:val="1000"/></w:trPr><w:tc>' +
  `<w:tcPr><w:tcW w:w="${CONTENT_WIDTH}" w:type="dxa"/><w:shd w:val="clear" w:fill="FFFFFF"/></w:tcPr>` +
  para("", { size: 24, after: 0 }) +
  "</w:tc></w:tr>" +
  "</w:tbl>" +
  // More space between questions than inside one.
  para("", { size: 20, after: 0 });

function build(mdPath) {
  const md = readFileSync(mdPath, "utf8");

  // Pass one: parse. A line indented under a question is that question's note,
  // not a question of its own — instructions belong where they are needed. A run
  // of ordinary lines is ONE paragraph: markdown hard-wraps, and rendering each
  // wrapped line as its own paragraph is what made the intro look broken.
  const items = [];
  let prose = [];

  const flushProse = () => {
    if (prose.length > 0) {
      items.push({ type: "prose", text: prose.join(" ") });
      prose = [];
    }
  };

  for (const raw of md.split("\n")) {
    const line = raw.trim();

    if (!line || /^---+$/.test(line)) {
      flushProse();
      continue;
    }

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushProse();
      items.push({ type: `h${h[1].length}`, text: plain(h[2]) });
      continue;
    }

    const tick = line.match(/^[-*]\s+\[[ xX]?\]\s+(.*)$/);
    if (tick) {
      flushProse();
      items.push({ type: "q", text: plain(tick[1]), tick: true });
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      flushProse();
      items.push({ type: "q", text: plain(bullet[1]), tick: false });
      continue;
    }

    // Indented under a question, and no paragraph in progress: it is that
    // question's note rather than prose of its own.
    const last = items[items.length - 1];
    if (prose.length === 0 && /^\s\s+\S/.test(raw) && last?.type === "q" && !last.note) {
      last.note = plain(line);
      continue;
    }

    prose.push(plain(line.replace(/^>\s?/, "")));
  }
  flushProse();

  // Pass two: render, now that the totals are known — progress is only
  // reassuring if it says what it is progress towards.
  const totalQuestions = items.filter((i) => i.type === "q").length;
  const totalSections = items.filter((i) => i.type === "h2").length;

  const body = [];
  let n = 0;
  let section = 0;
  let seenSection = false;
  let seenFirstQuestion = false;

  for (const item of items) {
    if (item.type === "h1") {
      body.push(para(item.text, { size: 40, bold: true, after: 120 }));
      continue;
    }
    if (item.type === "h2") {
      section += 1;
      if (seenSection) body.push(para("", { size: 2, after: 0, pageBreak: true }));
      body.push(sectionBand(`Section ${section} of ${totalSections}`, item.text));
      seenSection = true;
      continue;
    }
    if (item.type === "h3") {
      body.push(para(item.text, { size: 26, bold: true, before: 240, after: 100 }));
      continue;
    }
    if (item.type === "q") {
      if (!seenFirstQuestion) {
        body.push(
          para(
            "If you do not know an answer, write \u201cdon\u2019t know\u201d and move on \u2014 that is a " +
              "useful answer too. Nothing here has to be filled in perfectly, and you can " +
              "answer in any language.",
            { size: 20, italic: true, color: "5A5A5A", after: 200 },
          ),
        );
        seenFirstQuestion = true;
      }
      n += 1;
      body.push(questionBlock(n, totalQuestions, item.text, item.note, item.tick));
      continue;
    }
    body.push(para(item.text, { size: 22, after: 120 }));
  }

  const doc =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:document ${W}><w:body>${body.join("")}` +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>' +
    "</w:body></w:document>";

  const dir = mkdtempSync(join(tmpdir(), "homework-"));
  mkdirSync(join(dir, "_rels"));
  mkdirSync(join(dir, "word"));
  writeFileSync(
    join(dir, "[Content_Types].xml"),
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      "</Types>",
  );
  writeFileSync(
    join(dir, "_rels", ".rels"),
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      "</Relationships>",
  );
  writeFileSync(join(dir, "word", "document.xml"), doc);

  const out = outArg ?? resolve(`${basename(mdPath, extname(mdPath))}.docx`);
  rmSync(out, { force: true });
  execFileSync("zip", ["-q", "-X", "-r", out, ".", "-i", "*"], { cwd: dir });
  rmSync(dir, { recursive: true, force: true });
  return out;
}

function read(docxPath) {
  const xml = execFileSync("unzip", ["-p", docxPath, "word/document.xml"], {
    maxBuffer: 64 * 1024 * 1024,
  }).toString();

  // Join runs inside a paragraph, but keep paragraph breaks — a question and its
  // note are separate paragraphs in one cell, and so are multi-line answers.
  const cellText = (cell) =>
    (cell.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [cell])
      .map((p) =>
        (p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) ?? [])
          .map((t) => t.replace(/<[^>]+>/g, ""))
          .join(""),
      )
      .filter(Boolean)
      .join("\n")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();

  const out = [];
  let answered = 0;
  let total = 0;

  // Walk paragraphs and table rows in document order so headings keep their place.
  for (const block of xml.match(/<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>/g) ?? []) {
    if (block.startsWith("<w:tbl")) {
      const cells = block.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) ?? [];
      // Section bands are one-cell tables. They are headings, not questions, and
      // counting them would inflate the answered/total the done_when checks.
      if (cells.length < 2) {
        const band = cellText(cells[0] ?? "").split("\n");
        if (band.length > 1) out.push(`\n## ${band[band.length - 1]}\n`);
        continue;
      }
      const q = cellText(cells[0] ?? "").replace(/^Question \d+ of \d+\s*/, "");
      const a = cellText(cells[1] ?? "").replace(/^Your answer:\s*/, "");
      if (!q) continue;
      total += 1;
      if (a) answered += 1;
      out.push(`- ${q}`);
      out.push(a ? `  > ${a.split("\n").join("\n  > ")}` : "  > _(unanswered)_");
      continue;
    }
    // Paragraphs inside table cells were consumed above; this is body text only.
    const t = cellText(block);
    if (!t) continue;
    const heading = /<w:b\/>/.test(block);
    out.push(heading ? `\n## ${t}\n` : t);
  }

  const md = `# ${basename(docxPath, extname(docxPath))}\n\n${answered}/${total} answered.\n\n${out.join("\n")}\n`;
  if (outArg) {
    writeFileSync(outArg, md);
    return { path: outArg, answered, total };
  }
  process.stdout.write(md);
  return { path: null, answered, total };
}

if (cmd === "build") {
  console.log(build(resolve(target)));
} else if (cmd === "read") {
  const r = read(resolve(target));
  if (r.path) console.log(`${r.path} — ${r.answered}/${r.total} answered`);
} else {
  console.error(`unknown command: ${cmd}`);
  process.exit(1);
}
