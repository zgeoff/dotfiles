#!/usr/bin/env bash
# stdio launcher for the user-scope Fly MCP server.
# Runs `fly mcp server` with only the read-only org token from op://zgeoff/fly-mcp, in a clean
# environment and its own config dir, so your own `fly auth login` session and any other
# credential in the parent environment never reach the agents.
set -euo pipefail
sa=$(jq -er '.env.OP_SERVICE_ACCOUNT_TOKEN | select(. != "")' "$HOME/.claude/settings.json") ||
  { echo "fly-mcp: no OP_SERVICE_ACCOUNT_TOKEN in ~/.claude/settings.json" >&2; exit 1; }
token=$(OP_SERVICE_ACCOUNT_TOKEN=$sa \
  op read op://zgeoff/fly-mcp/credential)
[[ -n $token ]] || { echo "fly-mcp: empty token in op://zgeoff/fly-mcp" >&2; exit 1; }
config_dir="${XDG_STATE_HOME:-$HOME/.local/state}/fly-mcp"
mkdir -p "$config_dir"
exec env -i HOME="$HOME" PATH="$PATH" FLY_CONFIG_DIR="$config_dir" FLY_ACCESS_TOKEN="$token" \
  fly mcp server
