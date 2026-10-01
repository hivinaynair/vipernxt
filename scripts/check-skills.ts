#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = join(import.meta.dir, "..");
const words = (text: string) => text.trim().split(/\s+/).length;
const skillsRoot = join(root, ".agents/skills");
const lock = JSON.parse(readFileSync(join(root, "skills-lock.json"), "utf8"));
const issues: string[] = [];
let total = 0;
for (const name of readdirSync(skillsRoot)) {
  const file = join(skillsRoot, name, "SKILL.md");
  if (!existsSync(file)) continue;
  const text = readFileSync(file, "utf8");
  const count = words(text);
  total += count;
  if (process.argv.includes("--update-lock")) {
    lock.skills[name] = {
      ...lock.skills[name],
      source: lock.skills[name]?.source ?? ".",
      sourceType: lock.skills[name]?.sourceType ?? "local",
      skillPath: `.agents/skills/${name}/SKILL.md`,
      computedHash: createHash("sha256").update(text).digest("hex"),
    };
  }
  if (!text.startsWith(`---\nname: ${name}\n`)) issues.push(`${name}: invalid skill identity`);
  const description = text.match(/^description: (.+)$/m)?.[1];
  if (!description || words(description) > 24) issues.push(`${name}: description needs <=24 words`);
  if (count > 360)
    issues.push(`${name}: entrypoint exceeds 360 words; load relevant detail selectively`);
  if (lock.skills[name]?.computedHash !== createHash("sha256").update(text).digest("hex"))
    issues.push(`${name}: skill lock hash is stale`);
  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].split("#")[0];
    if (target && !/^[a-z]+:/i.test(target) && !existsSync(resolve(dirname(file), target)))
      issues.push(`${name}: broken link ${target}`);
  }
}
if (total > 4000) issues.push(`Skill catalog exceeds 4000 words (${total})`);
const common = ["AGENTS.md", ".agents/skills/CONTRACT.md", ".cursor/rules/playbook.mdc"].reduce(
  (sum, file) => sum + words(readFileSync(join(root, file), "utf8")),
  0,
);
if (common > 900) issues.push(`Shared agent context exceeds 900 words (${common})`);
if (process.argv.includes("--update-lock"))
  writeFileSync(join(root, "skills-lock.json"), `${JSON.stringify(lock, null, 2)}\n`);
if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else console.log(`Skills verified: ${total} entrypoint words; ${common} shared-context words`);
