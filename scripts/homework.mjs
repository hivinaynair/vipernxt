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
//   ## Stage 2 — the counter clerk   heading, starts a new page
//   ### What to ask                  sub-heading
//   - Walk me through yesterday      question, gets an answer box
//   - [ ] Photograph every screen    thing to capture, gets a tick box and an answer box
//   Anything else                    instruction; no box, nobody has to fill it

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

const para = (text, { size = 22, bold = false, before = 0, pageBreak = false } = {}) =>
  `<w:p><w:pPr>${pageBreak ? "<w:pageBreakBefore/>" : ""}<w:spacing w:before="${before}" w:after="80"/></w:pPr>` +
  `<w:r><w:rPr>${bold ? "<w:b/>" : ""}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;

// Question on the left, an empty bordered cell on the right. Typing into a table cell is
// the one Word interaction nobody needs explaining, and it makes read-back unambiguous.
const row = (question, tick) =>
  "<w:tr><w:tc>" +
  '<w:tcPr><w:tcW w:w="4000" w:type="dxa"/></w:tcPr>' +
  para((tick ? "☐  " : "") + question) +
  "</w:tc><w:tc>" +
  '<w:tcPr><w:tcW w:w="5200" w:type="dxa"/><w:shd w:val="clear" w:fill="FBFBFB"/></w:tcPr>' +
  '<w:p><w:pPr><w:spacing w:after="240"/></w:pPr></w:p>' +
  "</w:tc></w:tr>";

const tableOpen =
  "<w:tbl><w:tblPr>" +
  '<w:tblW w:w="9200" w:type="dxa"/>' +
  "<w:tblBorders>" +
  ["top", "left", "bottom", "right", "insideH", "insideV"]
    .map((e) => `<w:${e} w:val="single" w:sz="4" w:space="0" w:color="BBBBBB"/>`)
    .join("") +
  "</w:tblBorders>" +
  '<w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/>' +
  '<w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar>' +
  "</w:tblPr>";

function build(mdPath) {
  const md = readFileSync(mdPath, "utf8");
  const body = [];
  let inTable = false;
  let seenStage = false;

  const closeTable = () => {
    if (inTable) {
      body.push("</w:tbl>");
      body.push('<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>');
      inTable = false;
    }
  };
  const openTable = () => {
    if (!inTable) {
      body.push(tableOpen);
      inTable = true;
    }
  };

  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^---+$/.test(line)) continue;

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      closeTable();
      const level = h[1].length;
      const pageBreak = level === 2 && seenStage;
      if (level === 2) seenStage = true;
      body.push(
        para(plain(h[2]), {
          size: level === 1 ? 36 : level === 2 ? 28 : 24,
          bold: true,
          before: level === 1 ? 0 : 240,
          pageBreak,
        }),
      );
      continue;
    }

    const tick = line.match(/^[-*]\s+\[[ xX]?\]\s+(.*)$/);
    if (tick) {
      openTable();
      body.push(row(plain(tick[1]), true));
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      openTable();
      body.push(row(plain(bullet[1]), false));
      continue;
    }

    closeTable();
    body.push(para(plain(line.replace(/^>\s?/, ""))));
  }
  closeTable();

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

  const cellText = (cell) =>
    (cell.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) ?? [])
      .map((t) => t.replace(/<[^>]+>/g, ""))
      .join("")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();

  const out = [];
  let answered = 0;
  let total = 0;

  // Walk paragraphs and table rows in document order so headings keep their place.
  for (const block of xml.match(/<w:tr\b[\s\S]*?<\/w:tr>|<w:p\b[\s\S]*?<\/w:p>/g) ?? []) {
    if (block.startsWith("<w:tr")) {
      const cells = block.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) ?? [];
      const q = cellText(cells[0] ?? "");
      const a = cellText(cells[1] ?? "");
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
