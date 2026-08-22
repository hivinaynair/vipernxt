const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;

export function isTestFile(path) {
  return TEST_FILE.test(path);
}

export function bucket(path) {
  const parts = path.split("/");
  const featureIndex = parts.indexOf("features");
  if (featureIndex !== -1 && parts[featureIndex + 1]) {
    return `features/${parts[featureIndex + 1]}`;
  }
  if (parts[0] === "src" && parts[1] === "app") {
    return "app";
  }
  if (path === "src/proxy.ts") {
    return "src/proxy.ts";
  }
  if (parts[0] === "src" && parts[1] === "shared") {
    return "shared";
  }
  return path;
}

export function summarizeViolations(violations, { strict = false } = {}) {
  const filtered = strict
    ? violations
    : violations.filter((violation) => !isTestFile(violation.from));

  const groups = new Map();
  const fromFiles = new Set();

  for (const violation of filtered) {
    const from = bucket(violation.from);
    const to = bucket(violation.to);
    const key = `${from} → ${to}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        from,
        to,
        rule: violation.rule?.name ?? "unknown",
        files: new Set(),
      };
      groups.set(key, group);
    }
    group.files.add(violation.from);
    fromFiles.add(violation.from);
  }

  const pairs = [...groups.values()]
    .map((group) => ({
      key: group.key,
      from: group.from,
      to: group.to,
      rule: group.rule,
      files: [...group.files].sort(),
    }))
    .sort((a, b) => b.files.length - a.files.length || a.key.localeCompare(b.key));

  return {
    edges: filtered.length,
    files: [...fromFiles].sort(),
    pairs,
  };
}

const FIX_HINT =
  "Hoist the shared type or helper to src/shared or packages/, or compose in app/ / src/proxy.ts.";

export function formatReport(summary, { strict = false } = {}) {
  if (summary.pairs.length === 0) {
    return strict
      ? "Feature boundaries are clean (including tests)."
      : "Feature boundaries are clean.";
  }

  const lines = [
    `Feature boundary violations: ${summary.edges} edge(s) in ${summary.files.length} file(s)`,
    "",
  ];

  for (const pair of summary.pairs) {
    lines.push(`${pair.key}  (${pair.files.length} file${pair.files.length === 1 ? "" : "s"})`);
    const shown = pair.files.slice(0, 8);
    for (const file of shown) {
      lines.push(`  ${file}`);
    }
    const extra = pair.files.length - shown.length;
    if (extra > 0) {
      lines.push(`  …and ${extra} more`);
    }
  }

  lines.push("", FIX_HINT);
  if (!strict) {
    lines.push("Tests are excluded. Re-run with --strict to include them.");
  }
  return lines.join("\n");
}
