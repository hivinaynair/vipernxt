#!/usr/bin/env node
// Normalises a salvage dump so an agent can actually read it.
//
//   node scripts/salvage-inbox.mjs <source-dir-or-files-or-zip...> [--inbox <dir>] [--rotate <deg>]
//
// HEIC/PDF/oversized images break agent sessions outright, so nothing is read
// until it is a JPEG under the vision limits. Originals are never touched.
//
//   <inbox>/raw/     originals, copied verbatim (gitignored — may hold real data)
//   <inbox>/pages/   normalised JPEGs, <= 2000px long edge, one per page for PDFs
//   <inbox>/INVENTORY.md   one line per page, with a blank caption for the human
//
// macOS: sips. Linux (cloud agents): ffmpeg. HEIC that neither can read is
// copied to raw/ and listed as not rendered — export a JPEG.

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";

const LONG_EDGE = 2000; // above this the many-image dimension cap starts rejecting

// Photographs of a screen or a wall are often sideways with nothing in the EXIF to say
// so — the camera was level, the subject was not. Nothing can detect that from the file,
// so the agent looks at one page and re-runs with --rotate if the text runs vertically.

const args = process.argv.slice(2);
const flagAt = args.findIndex((a) => a.startsWith("--"));
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const inbox = resolve(flag("inbox", "docs/research/salvage-inbox"));
const rotate = Number(flag("rotate", "0"));
const inputs = (flagAt === -1 ? args : args.slice(0, flagAt)).map((p) => resolve(p));

if (![0, 90, 180, 270].includes(rotate)) {
  console.error("--rotate must be 0, 90, 180 or 270");
  process.exit(1);
}

if (inputs.length === 0) {
  console.error("usage: salvage-inbox.mjs <dir-or-files...> [--inbox <dir>]");
  process.exit(1);
}

const raw = join(inbox, "raw");
const pages = join(inbox, "pages");
mkdirSync(raw, { recursive: true });
mkdirSync(pages, { recursive: true });

const SKIP_DIR = new Set(["raw", "pages", "__macosx"]);
const unzipped = [];

const listDir = (p) =>
  readdirSync(p)
    .filter((f) => !f.startsWith(".") && !SKIP_DIR.has(f.toLowerCase()) && f !== "INVENTORY.md")
    .map((f) => join(p, f));

const expand = (p) => {
  if (statSync(p).isDirectory()) return listDir(p).flatMap(expand);
  if (extname(p).toLowerCase() === ".zip") {
    copyFileSync(p, join(raw, basename(p)));
    const dir = mkdtempSync(join(tmpdir(), "pile-zip-"));
    unzipped.push(dir);
    try {
      execFileSync("unzip", ["-q", "-o", p, "-d", dir], { stdio: "ignore" });
    } catch {
      return [];
    }
    return listDir(dir).flatMap(expand);
  }
  return [p];
};

const files = inputs.flatMap(expand);

const IMAGE = new Set([
  ".heic",
  ".heif",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".tif",
  ".tiff",
  ".bmp",
]);
const TEXT = new Set([
  ".csv",
  ".tsv",
  ".txt",
  ".md",
  ".json",
  ".yaml",
  ".yml",
  ".eml",
  ".xlsx",
  ".xls",
  ".docx",
]);

const sh = (cmd, cmdArgs) => execFileSync(cmd, cmdArgs, { stdio: ["ignore", "pipe", "pipe"] });

const has = (bin) => {
  try {
    execFileSync("which", [bin], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

const toJpeg = (src, out) => {
  if (has("sips")) {
    const opts = ["-s", "format", "jpeg", "-Z", String(LONG_EDGE)];
    if (rotate) opts.push("-r", String(rotate));
    sh("sips", [...opts, src, "--out", out]);
    return out;
  }
  if (!has("ffmpeg")) {
    throw new Error("need sips (macOS) or ffmpeg (Linux) to render images");
  }
  const filters = [];
  if (rotate === 90) filters.push("transpose=1");
  if (rotate === 180) filters.push("transpose=1,transpose=1");
  if (rotate === 270) filters.push("transpose=2");
  filters.push(
    `scale='min(${LONG_EDGE}\\,iw)':'min(${LONG_EDGE}\\,ih)':force_original_aspect_ratio=decrease`,
  );
  sh("ffmpeg", ["-y", "-i", src, "-vf", filters.join(","), "-q:v", "3", out]);
  return out;
};

const rows = [];
for (const src of files) {
  const ext = extname(src).toLowerCase();
  const stem = basename(src, extname(src));
  copyFileSync(src, join(raw, basename(src)));

  if (IMAGE.has(ext)) {
    const out = join(pages, `${stem}.jpg`);
    try {
      toJpeg(src, out);
      rows.push({ page: basename(out), from: basename(src), kind: "image" });
    } catch {
      rows.push({
        page: "—",
        from: basename(src),
        kind: "image NOT RENDERED — export as JPEG",
      });
    }
  } else if (ext === ".pdf") {
    // qlmanage renders page 1 only; pdftoppm does every page when poppler is present.
    try {
      sh("pdftoppm", ["-jpeg", "-r", "150", src, join(pages, stem)]);
      for (const f of readdirSync(pages).filter(
        (f) => f.startsWith(`${stem}-`) && f.endsWith(".jpg"),
      )) {
        toJpeg(join(pages, f), join(pages, f));
        rows.push({ page: f, from: basename(src), kind: "pdf page" });
      }
    } catch {
      rows.push({
        page: "—",
        from: basename(src),
        kind: "PDF NOT RENDERED — install poppler (brew install poppler)",
      });
    }
  } else if (TEXT.has(ext)) {
    copyFileSync(src, join(pages, basename(src)));
    rows.push({ page: basename(src), from: basename(src), kind: "text — read directly" });
  } else {
    rows.push({ page: "—", from: basename(src), kind: `unhandled ${ext || "file"}` });
  }
}

rows.sort((a, b) => a.page.localeCompare(b.page));
const inventory = `# Salvage inbox

${rows.length} item(s) normalised from ${files.length} file(s). Originals in \`raw/\`, readable pages in \`pages/\`.

**Caption every row before anything is mined.** What is this, and who gave it to you?
An uncaptioned photograph is not evidence.
${rotate ? `\nRotated ${rotate}° on import.\n` : "\nIf the text in these runs sideways, re-run with `--rotate 90` — legibility is worth the second pass.\n"}

| Page | From | Kind | Caption |
|---|---|---|---|
${rows.map((r) => `| \`${r.page}\` | \`${r.from}\` | ${r.kind} | |`).join("\n")}

## Not here

List what you looked for and could not find. A missing artifact is a finding — it
goes to \`field-kit\` as an open question, it does not get papered over.

- 
`;

writeFileSync(join(inbox, "INVENTORY.md"), inventory);
for (const dir of unzipped) rmSync(dir, { recursive: true, force: true });
console.log(`${rows.length} page(s) → ${pages}`);
console.log(`inventory → ${join(inbox, "INVENTORY.md")}`);
