#!/usr/bin/env bash
# Provision a new product: GitHub repo, Neon databases, Vercel project, Linear team.
# Opinionated on purpose. Idempotent — safe to re-run; it skips what already exists.
#
#   ./setup.sh
#
set -uo pipefail

BOLD=$'\033[1m'; DIM=$'\033[2m'; OK=$'\033[32m'; WARN=$'\033[33m'; OFF=$'\033[0m'
TOTAL=7; STAGE=0
stage() { STAGE=$((STAGE+1)); printf '\n%s[%d/%d] %s%s\n' "$BOLD" "$STAGE" "$TOTAL" "$1" "$OFF"; }
say()  { printf '      %s\n' "$1"; }
good() { printf '      %s✓%s %s\n' "$OK" "$OFF" "$1"; }
warn() { printf '      %s!%s %s\n' "$WARN" "$OFF" "$1"; }
ask()  { local p="$1" v; read -r -p "      $p " v; printf '%s' "$v"; }
confirm() { local v; read -r -p "      $1 [y/N] " v; [[ "$v" == [yY]* ]]; }
have() { command -v "$1" >/dev/null 2>&1; }

env_put() { # env_put FILE KEY VALUE — idempotent upsert
  local f="$1" k="$2" val="$3"
  touch "$f"
  if grep -q "^${k}=" "$f" 2>/dev/null; then
    grep -v "^${k}=" "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  fi
  printf '%s=%s\n' "$k" "$val" >> "$f"
}

# ── 0. preflight ─────────────────────────────────────────────────────────────
stage "Checking tools"
missing=0
for t in gh vercel neonctl git; do
  if have "$t"; then good "$t"; else warn "$t not found"; missing=1; fi
done
if [ "$missing" = 1 ]; then
  say "Install what is missing, then re-run."
  say "  gh:       brew install gh"
  say "  vercel:   bun add -g vercel"
  say "  neonctl:  bun add -g neonctl"
  exit 1
fi
gh auth status >/dev/null 2>&1 || { warn "gh not authenticated"; say "Run: gh auth login"; exit 1; }
good "gh authenticated as $(gh api user --jq .login 2>/dev/null || echo '?')"
neonctl me >/dev/null 2>&1 || { warn "neonctl not authenticated"; say "Run: neonctl auth"; exit 1; }
good "neonctl authenticated"

playbook_get() {
  local k="$1"
  [ -f .env.playbook ] || return 0
  grep "^${k}=" .env.playbook 2>/dev/null | tail -1 | cut -d= -f2-
}

PRODUCT="$(playbook_get PRODUCT)"
if [ -z "$PRODUCT" ]; then
  PRODUCT="$(ask 'Product name (kebab-case, e.g. kubera):')"
  [ -n "$PRODUCT" ] || { warn "A name is required. Run the customize skill first, or type one here."; exit 1; }
  env_put ".env.playbook" PRODUCT "$PRODUCT"
  good "recorded PRODUCT=$PRODUCT in .env.playbook"
else
  good "product name from customize: $PRODUCT"
fi
ENVFILE="apps/web/.env.local"
[ -d apps/web ] || ENVFILE=".env.local"

# ── 1. github ────────────────────────────────────────────────────────────────
stage "GitHub repository"
if git remote get-url origin >/dev/null 2>&1; then
  good "remote exists: $(git remote get-url origin)"
else
  if confirm "Create private repo ${PRODUCT} and push?"; then
    gh repo create "$PRODUCT" --private --source=. --remote=origin --push \
      && good "created and pushed" || warn "repo create failed — continuing"
  else
    say "skipped"
  fi
fi

# ── 2. neon ──────────────────────────────────────────────────────────────────
stage "Neon (one project, staging + production databases)"
say "One project named ${PRODUCT}. Two databases on the default branch: staging, production."

neon_project_id() {
  neonctl projects list --output json 2>/dev/null | python3 -c "
import sys, json
name = sys.argv[1]
ps = json.load(sys.stdin)
ps = ps.get('projects', ps) if isinstance(ps, dict) else ps
print(next((p['id'] for p in ps if p.get('name') == name), ''))
" "$1"
}

neon_has_db() {
  neonctl databases list --project-id "$1" --output json 2>/dev/null | python3 -c "
import sys, json
want = sys.argv[1]
data = json.load(sys.stdin)
dbs = data.get('databases', data) if isinstance(data, dict) else data
print('yes' if any(d.get('name') == want for d in dbs) else 'no')
" "$2"
}

pid="$(neon_project_id "$PRODUCT")"
if [ -n "$pid" ]; then
  good "project $PRODUCT exists ($pid)"
elif confirm "Create Neon project $PRODUCT?"; then
  neonctl projects create --name "$PRODUCT" --database staging --output json --no-secrets \
    >/tmp/neon-project.json 2>/dev/null \
    && good "created $PRODUCT (database: staging)" \
    || warn "create failed for $PRODUCT"
  pid="$(neon_project_id "$PRODUCT")"
else
  say "skipped Neon"
  pid=""
fi

if [ -n "$pid" ]; then
  for db in staging production; do
    if [ "$(neon_has_db "$pid" "$db")" = yes ]; then
      good "database $db exists"
    elif confirm "Create database $db on $PRODUCT?"; then
      neonctl databases create --name "$db" --project-id "$pid" --output json \
        >/tmp/neon-db-$db.json 2>/dev/null \
        && good "created database $db" \
        || { warn "create failed for $db"; continue; }
    else
      say "skipped database $db"; continue
    fi
    pooled=$(neonctl connection-string --project-id "$pid" --database-name "$db" --pooled 2>/dev/null)
    direct=$(neonctl connection-string --project-id "$pid" --database-name "$db" 2>/dev/null)
    if [ "$db" = staging ]; then
      [ -n "$pooled" ] && env_put "$ENVFILE" DATABASE_URL "$pooled" && good "DATABASE_URL (staging) → $ENVFILE"
      [ -n "$direct" ] && env_put "$ENVFILE" DATABASE_URL_UNPOOLED "$direct" && good "DATABASE_URL_UNPOOLED (staging) → $ENVFILE"
    fi
    if [ -n "$direct" ] && gh repo view >/dev/null 2>&1; then
      gh secret set DATABASE_URL_UNPOOLED --env "$db" --body "$direct" 2>/dev/null \
        && good "GitHub secret set for $db" \
        || warn "could not set secret — create the '$db' Environment in GitHub first"
    fi
  done
fi

# ── 3. vercel ────────────────────────────────────────────────────────────────
stage "Vercel project"
if [ -f .vercel/project.json ]; then
  good "already linked"
elif confirm "Link this directory to Vercel?"; then
  vercel link --yes >/dev/null 2>&1 && good "linked" || warn "vercel link failed — run 'vercel link' manually"
else
  say "skipped"
fi

# ── 4. clerk ─────────────────────────────────────────────────────────────────
stage "Clerk"
if ! have clerk; then
  warn "clerk CLI not found — skipping"
  say "Install with: bun add -g @clerk/clerk-cli   (then: clerk auth login)"
elif ! clerk whoami >/dev/null 2>&1; then
  warn "clerk not authenticated"
  say "Run: clerk auth login   then re-run this script"
else
  good "clerk authenticated"
  linked=$(clerk whoami 2>/dev/null | python3 -c "import sys,json;print('yes' if json.load(sys.stdin).get('linked') else 'no')" 2>/dev/null || echo no)
  if [ "$linked" = yes ]; then
    good "project already linked to a Clerk application"
  else
    say "This project is not linked to a Clerk application yet."
    if confirm "Create a new Clerk app named ${PRODUCT}?"; then
      clerk apps create "$PRODUCT" && good "created $PRODUCT" || warn "create failed"
      clerk link 2>/dev/null && good "linked" || warn "link failed — run 'clerk link' manually"
    elif confirm "Link an existing app instead?"; then
      clerk link 2>/dev/null && good "linked" || warn "link failed"
    else
      say "skipped"
    fi
  fi

  # The CLI writes the env file itself: keys never pass through this script,
  # never appear in output, and never reach an agent's context.
  if clerk whoami 2>/dev/null | grep -q '"linked": *true'; then
    clerk env pull --file "$ENVFILE" >/dev/null 2>&1 \
      && good "development keys written to $ENVFILE" \
      || warn "env pull failed — run: clerk env pull --file $ENVFILE"
    have clerk && clerk doctor >/dev/null 2>&1 && good "clerk doctor passed" || true

    if confirm "Enable organizations (B2B — teams, seats, roles)?"; then
      clerk enable orgs && good "organizations enabled" || warn "enable orgs failed"
    else
      say "organizations off — enable later with: clerk enable orgs"
    fi
  fi
fi

# ── 5. linear ────────────────────────────────────────────────────────────────
stage "Linear team"
say "Linear has no CLI and its API cannot create teams."
say "Create a team for ${PRODUCT} at https://linear.app/settings/teams"
key="$(ask 'Team key once created (e.g. KUB), or blank to skip:')"
if [ -n "$key" ]; then
  env_put ".env.playbook" LINEAR_TEAM "$key"
  good "recorded LINEAR_TEAM=$key in .env.playbook"
else
  say "skipped — linear-sync will ask again later"
fi

# ── 6. done ──────────────────────────────────────────────────────────────────
stage "Summary"
good "product: $PRODUCT"
[ -f "$ENVFILE" ] && good "env: $ENVFILE" || warn "no env file written"
say ""
say "Not done here, on purpose:"
say "  · Production Clerk keys — run 'clerk env pull --instance prod' at deploy time"
say "  · GitHub Environments 'staging' and 'production' if secrets failed"
say ""
say "Next: bun install, then /next to start shaping."
