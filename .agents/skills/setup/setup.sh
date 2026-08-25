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

PRODUCT="$(ask 'Product name (kebab-case, e.g. kubera):')"
[ -n "$PRODUCT" ] || { warn "A name is required."; exit 1; }
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
stage "Neon databases (staging + production)"
say "Two projects keeps environments genuinely separate."
for envname in staging production; do
  proj="${PRODUCT}-${envname}"
  if neonctl projects list --output json 2>/dev/null | grep -q "\"name\": *\"$proj\""; then
    good "$proj exists"
  elif confirm "Create Neon project $proj?"; then
    neonctl projects create --name "$proj" --output json >/tmp/neon-$envname.json 2>/dev/null \
      && good "created $proj" || { warn "create failed for $proj"; continue; }
  else
    say "skipped $proj"; continue
  fi
  pid=$(neonctl projects list --output json 2>/dev/null \
        | python3 -c "import sys,json;ps=json.load(sys.stdin);ps=ps.get('projects',ps) if isinstance(ps,dict) else ps;print(next((p['id'] for p in ps if p.get('name')=='$proj'),''))" 2>/dev/null)
  [ -n "$pid" ] || { warn "could not resolve project id for $proj"; continue; }
  pooled=$(neonctl connection-string --project-id "$pid" --pooled 2>/dev/null)
  direct=$(neonctl connection-string --project-id "$pid" 2>/dev/null)
  if [ "$envname" = staging ]; then
    [ -n "$pooled" ] && env_put "$ENVFILE" DATABASE_URL "$pooled" && good "DATABASE_URL → $ENVFILE"
    [ -n "$direct" ] && env_put "$ENVFILE" DATABASE_URL_UNPOOLED "$direct" && good "DATABASE_URL_UNPOOLED → $ENVFILE"
  fi
  if [ -n "$direct" ] && gh repo view >/dev/null 2>&1; then
    gh_env=$([ "$envname" = production ] && echo production || echo staging)
    gh secret set DATABASE_URL_UNPOOLED --env "$gh_env" --body "$direct" 2>/dev/null \
      && good "GitHub secret set for $gh_env" \
      || warn "could not set secret — create the '$gh_env' Environment in GitHub first"
  fi
done

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
