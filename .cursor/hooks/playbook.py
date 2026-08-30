#!/usr/bin/env python3
"""Playbook harness hooks.

Commands (stdout is JSON for Cursor; diagnostics go to stderr):

  gate      preToolUse — deny product UI/route/feature writes until shape is done
  session   sessionStart — inject a short pipeline digest as additional_context
  selftest  run fixtures; exit 1 on failure

Repo root is two levels above this file. Cloud and local checkouts both work.
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None  # type: ignore[assignment]

ROOT = Path(__file__).resolve().parents[2]
STATE_PATH = ROOT / "docs" / "product" / "state.yaml"
GATED_FRAGMENTS = ("/src/app/", "/src/features/")
PLAYBOOK_SKILLS = (
    "next",
    "status",
    "artifacts",
    "journeys",
    "design-system",
    "shape",
    "salvage",
    "setup",
    "customize",
    "ontology",
    "prototype",
    "field-kit",
    "linear-sync",
)


def emit(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    sys.stdout.write("\n")


def read_stdin() -> str:
    return sys.stdin.read() if not sys.stdin.isatty() else ""


# ── minimal YAML subset, used when pyyaml is unavailable ─────────────────────
# The state file uses a small, documented subset: nested block maps, inline flow
# maps, and block sequences of maps. A gate that guards the build must not
# depend on a third-party library being installed in every environment.


def _scalar(tok: str) -> Any:
    tok = tok.strip()
    if not tok:
        return None
    if tok[0] in "\"'" and tok[-1] == tok[0] and len(tok) > 1:
        return tok[1:-1]
    low = tok.lower()
    if low in ("true", "yes"):
        return True
    if low in ("false", "no"):
        return False
    if low in ("null", "~"):
        return None
    try:
        return int(tok)
    except ValueError:
        return tok


def _split_top(text: str, sep: str = ",") -> list[str]:
    parts, depth, buf = [], 0, ""
    for ch in text:
        if ch in "[{":
            depth += 1
        elif ch in "]}":
            depth -= 1
        if ch == sep and depth == 0:
            parts.append(buf)
            buf = ""
        else:
            buf += ch
    if buf.strip():
        parts.append(buf)
    return parts


def _flow(tok: str) -> Any:
    tok = tok.strip()
    if tok.startswith("{") and tok.endswith("}"):
        out: dict[str, Any] = {}
        for part in _split_top(tok[1:-1]):
            if ":" in part:
                k, _, v = part.partition(":")
                out[k.strip()] = _flow(v)
        return out
    if tok.startswith("[") and tok.endswith("]"):
        return [_flow(p) for p in _split_top(tok[1:-1])]
    return _scalar(tok)


def _strip_comment(line: str) -> str:
    out, quote = "", ""
    for ch in line:
        if quote:
            if ch == quote:
                quote = ""
        elif ch in "\"'":
            quote = ch
        elif ch == "#":
            break
        out += ch
    return out.rstrip()


def _parse_block(lines: list[tuple[int, str]], idx: int, indent: int) -> tuple[Any, int]:
    if idx < len(lines) and lines[idx][1].startswith("- "):
        items: list[Any] = []
        while idx < len(lines) and lines[idx][0] == indent and lines[idx][1].startswith("- "):
            rest = lines[idx][1][2:].strip()
            idx += 1
            if rest.startswith("{") or not (":" in rest and not rest.startswith("{")):
                items.append(_flow(rest))
                continue
            item: dict[str, Any] = {}
            k, _, v = rest.partition(":")
            if v.strip():
                item[k.strip()] = _flow(v)
            else:
                child, idx = _parse_block(lines, idx, lines[idx][0] if idx < len(lines) else indent + 2)
                item[k.strip()] = child
            while idx < len(lines) and lines[idx][0] > indent:
                k2, _, v2 = lines[idx][1].partition(":")
                if v2.strip():
                    item[k2.strip()] = _flow(v2)
                    idx += 1
                else:
                    inner_indent = lines[idx + 1][0] if idx + 1 < len(lines) else lines[idx][0] + 2
                    key2 = k2.strip()
                    idx += 1
                    child, idx = _parse_block(lines, idx, inner_indent)
                    item[key2] = child
            items.append(item)
        return items, idx

    mapping: dict[str, Any] = {}
    while idx < len(lines) and lines[idx][0] == indent:
        line = lines[idx][1]
        if ":" not in line:
            idx += 1
            continue
        key, _, val = line.partition(":")
        key = key.strip()
        if val.strip():
            mapping[key] = _flow(val)
            idx += 1
        else:
            idx += 1
            if idx < len(lines) and lines[idx][0] > indent:
                child, idx = _parse_block(lines, idx, lines[idx][0])
            elif idx < len(lines) and lines[idx][1].startswith("- ") and lines[idx][0] == indent:
                child, idx = _parse_block(lines, idx, indent)
            else:
                child = None
            mapping[key] = child
    return mapping, idx


def mini_yaml_load(text: str) -> Any:
    lines: list[tuple[int, str]] = []
    for raw in text.splitlines():
        stripped = _strip_comment(raw)
        if not stripped.strip():
            continue
        lines.append((len(stripped) - len(stripped.lstrip()), stripped.strip()))
    if not lines:
        return {}
    value, _ = _parse_block(lines, 0, lines[0][0])
    return value


def load_yaml_text(text: str) -> Any:
    """Parse YAML with pyyaml when present, the bundled subset parser otherwise."""
    if yaml is None:
        return mini_yaml_load(text)
    return yaml.safe_load(text)


def load_state(text: str | None = None) -> dict[str, Any] | None:
    """Return parsed state, empty dict on missing file, or None on parse failure."""
    if text is None:
        if not STATE_PATH.is_file():
            return {}
        text = STATE_PATH.read_text(encoding="utf-8")
    try:
        if yaml is None:
            data = mini_yaml_load(text) or {}
        else:
            data = yaml.safe_load(text) or {}
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    return data


def phase_entries(state: dict[str, Any]) -> list[dict[str, Any]]:
    raw = state.get("phases") or {}
    if not isinstance(raw, dict):
        return []
    out: list[dict[str, Any]] = []
    for key, value in raw.items():
        if isinstance(value, dict):
            entry = dict(value)
            entry["_key"] = key
            out.append(entry)
    return out


def named_phase(state: dict[str, Any], name: str) -> dict[str, Any] | None:
    for entry in phase_entries(state):
        if str(entry.get("name") or "") == name:
            return entry
    return None


def shape_done(state: dict[str, Any]) -> bool:
    entry = named_phase(state, "shape")
    return bool(entry) and str(entry.get("status") or "") == "done"


def ui_writes_override(state: dict[str, Any]) -> str | None:
    raw = state.get("ui_writes")
    if raw is None:
        return None
    value = str(raw).strip().lower()
    if value in ("allow", "deny"):
        return value
    return None


def ui_writes_allowed(state: dict[str, Any] | None) -> tuple[bool, str]:
    """Whether product UI writes are allowed. Missing state file → allow (boilerplate)."""
    if state is None:
        return False, "docs/product/state.yaml is unreadable; refusing product UI writes"
    if state == {}:
        return True, "no product pipeline; boilerplate edits allowed"
    override = ui_writes_override(state)
    if override == "allow":
        return True, "ui_writes: allow"
    if override == "deny":
        return False, "ui_writes: deny"
    if shape_done(state):
        return True, "shape is done; design doc is approved"
    return False, "design doc is not approved (shape is not done)"


def collect_paths(tool_input: Any) -> list[str]:
    paths: list[str] = []

    def walk(node: Any) -> None:
        if isinstance(node, str):
            return
        if isinstance(node, dict):
            for key, value in node.items():
                if key in ("path", "file_path", "filePath", "target_notebook") and isinstance(
                    value, str
                ):
                    paths.append(value)
                else:
                    walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(tool_input)
    return paths


def is_gated_path(path: str) -> bool:
    normalized = path.replace("\\", "/")
    if not normalized.startswith("/"):
        normalized = "/" + normalized
    return any(fragment in normalized for fragment in GATED_FRAGMENTS)


def gate_from_payload(payload: dict[str, Any], state: dict[str, Any] | None) -> dict[str, Any]:
    tool_input = payload.get("tool_input") or payload.get("input") or {}
    paths = collect_paths(tool_input)
    gated = [p for p in paths if is_gated_path(p)]
    if not gated:
        return {"permission": "allow"}
    allowed, reason = ui_writes_allowed(state)
    if allowed:
        return {"permission": "allow"}
    return {
        "permission": "deny",
        "user_message": (
            "Product UI/routes/features are blocked until the design doc is approved. "
            f"{reason}."
        ),
        "agent_message": (
            "HOOK-DENY: writes under apps/*/src/app or apps/*/src/features are blocked "
            f"until shape is done (or ui_writes: allow). {reason}. "
            "Do not retry the same edit or bypass it with the shell. "
            "Work in docs/product, docs/plans, docs/journeys, or docs/research instead."
        ),
    }


def days_open(raised: str) -> str | None:
    try:
        start = date.fromisoformat(str(raised)[:10])
    except ValueError:
        return None
    delta = (date.today() - start).days
    if delta <= 0:
        return "today"
    if delta == 1:
        return "1 day"
    return f"{delta} days"


def compact_where(state: dict[str, Any]) -> str:
    entries = phase_entries(state)
    done = [str(e.get("name")) for e in entries if str(e.get("status") or "") == "done"]
    current = None
    for entry in entries:
        if str(entry.get("status") or "") in ("in-progress", "blocked"):
            current = str(entry.get("name"))
            break
    if current is None:
        current_key = str(state.get("phase") or "")
        current = current_key
        for entry in entries:
            if str(entry.get("_key")) == current_key:
                current = str(entry.get("name") or current_key)
                break
    next_name = None
    seen_current = False
    for entry in entries:
        name = str(entry.get("name") or "")
        if name == current:
            seen_current = True
            continue
        if seen_current and str(entry.get("status") or "") == "pending":
            next_name = name
            break
    parts = []
    if done:
        parts.append("done: " + ", ".join(done))
    if current:
        parts.append("now: " + str(current))
    if next_name:
        parts.append("next: " + next_name)
    return " · ".join(parts) if parts else "in progress"


def status_digest(state: dict[str, Any] | None) -> str:
    if state is None:
        return (
            "Pipeline state file exists but could not be parsed. "
            "Do not edit product UI until it is readable."
        )
    if state == {}:
        return (
            "There is no product being shaped here. App source may be edited (boilerplate). "
            "Offer to start a product if they want one."
        )
    lines: list[str] = []
    held = state.get("held") or []
    open_items = [
        h
        for h in held
        if isinstance(h, dict) and str(h.get("status") or "") == "open"
    ]
    if open_items:
        lines.append("Waiting on you")
        for item in open_items:
            what = str(item.get("what") or "a decision or facts").rstrip(".")
            age = days_open(str(item.get("raised") or ""))
            suffix = f" (open {age})" if age else ""
            lines.append(f"- {what}{suffix}")
    where = compact_where(state)
    if where:
        lines.append("Where we are")
        lines.append(where)
    deferred = [
        h
        for h in held
        if isinstance(h, dict) and str(h.get("status") or "") == "deferred"
    ]
    if deferred:
        lines.append("Deferred")
        for item in deferred:
            what = str(item.get("what") or "a later choice").rstrip(".")
            until = item.get("until")
            when = f" — again {until}" if until else ""
            lines.append(f"- {what}{when}")
    allowed, reason = ui_writes_allowed(state)
    lines.append("Do not" if not allowed else "App source")
    if allowed:
        lines.append(f"Writes under app routes/features are allowed ({reason}).")
    else:
        lines.append(
            "Do not edit apps/*/src/app or apps/*/src/features. "
            f"{reason}. A hook denies those writes."
        )
    lines.append("Harness")
    lines.append(
        "If next/status/shape are missing from your skill list, read "
        ".agents/skills/<name>/SKILL.md (also .cursor/skills/). "
        "Say that the catalog omitted them."
    )
    return "\n".join(lines)


def cmd_gate() -> int:
    raw = read_stdin()
    try:
        payload = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        payload = {}
    if not isinstance(payload, dict):
        payload = {}
    state = load_state()
    emit(gate_from_payload(payload, state))
    return 0


def cmd_session() -> int:
    read_stdin()
    emit({"additional_context": status_digest(load_state())})
    return 0


def _payload(path: str) -> dict[str, Any]:
    return {"tool_name": "StrReplace", "tool_input": {"path": path}}


def cmd_selftest() -> int:
    failures: list[str] = []

    def check(name: str, got: Any, expected: Any) -> None:
        if got != expected:
            failures.append(f"{name}: got {got!r} expected {expected!r}")

    pending = load_yaml_text(
        """
phase: 3
phases:
  3: { name: shape, status: pending }
"""
    )
    done = load_yaml_text(
        """
phase: 4
phases:
  3: { name: shape, status: done }
  4: { name: journeys, status: in-progress }
"""
    )
    deny_override = load_yaml_text(
        """
ui_writes: deny
phases:
  3: { name: shape, status: done }
"""
    )
    allow_override = load_yaml_text(
        """
ui_writes: allow
phases:
  3: { name: shape, status: pending }
"""
    )

    app = "/workspace/apps/web/src/app/page.tsx"
    feat = "apps/web/src/features/bookings/ui.tsx"
    envp = "/workspace/apps/web/src/env.ts"
    readme = "/workspace/README.md"

    check(
        "no-state app allow",
        gate_from_payload(_payload(app), {})["permission"],
        "allow",
    )
    check(
        "pending shape app deny",
        gate_from_payload(_payload(app), pending)["permission"],
        "deny",
    )
    check(
        "pending shape feature deny",
        gate_from_payload(_payload(feat), pending)["permission"],
        "deny",
    )
    check(
        "pending shape env allow",
        gate_from_payload(_payload(envp), pending)["permission"],
        "allow",
    )
    check(
        "pending shape readme allow",
        gate_from_payload(_payload(readme), pending)["permission"],
        "allow",
    )
    check(
        "shape done app allow",
        gate_from_payload(_payload(app), done)["permission"],
        "allow",
    )
    check(
        "ui_writes deny wins",
        gate_from_payload(_payload(app), deny_override)["permission"],
        "deny",
    )
    check(
        "ui_writes allow wins",
        gate_from_payload(_payload(app), allow_override)["permission"],
        "allow",
    )
    check(
        "unreadable yaml fail-closed",
        gate_from_payload(_payload(app), None)["permission"],
        "deny",
    )
    empty = status_digest({})
    if "no product being shaped" not in empty.lower():
        failures.append(f"empty digest: {empty!r}")
    digest = status_digest(
        load_yaml_text(
            """
phase: 2
phases:
  0: { name: salvage, status: done }
  2: { name: field, status: blocked }
  3: { name: shape, status: pending }
held:
  - id: H3
    what: Field visit to one temple
    raised: 2026-08-20
    status: open
"""
        )
    )
    for needle in ("Waiting on you", "Field visit", "Do not edit", "Harness"):
        if needle not in digest:
            failures.append(f"digest missing {needle!r}: {digest!r}")

    if failures:
        sys.stderr.write("selftest failed:\n")
        for line in failures:
            sys.stderr.write(f"  {line}\n")
        return 1
    sys.stderr.write(f"selftest passed ({len(PLAYBOOK_SKILLS)} playbook skills recorded)\n")
    return 0


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "gate":
        return cmd_gate()
    if cmd == "session":
        return cmd_session()
    if cmd == "selftest":
        return cmd_selftest()
    sys.stderr.write("usage: playbook.py gate|session|selftest\n")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
