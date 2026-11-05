#!/usr/bin/env bash
# stdio launcher for the user-scope impz MCP server.
# Runs `impz mcp --prefix agent-` with only the claude-mcp token from op://zgeoff/impz-mcp
# (scope manage on agent-* imps), in a clean environment with its own HOME, so the CLI's saved
# host token in ~/.config/impz/config.json never reaches the agents.
set -euo pipefail
sa=$(jq -er '.env.OP_SERVICE_ACCOUNT_TOKEN | select(. != "")' "$HOME/.claude/settings.json") ||
  {
    echo "impz-mcp: no OP_SERVICE_ACCOUNT_TOKEN in ~/.claude/settings.json" >&2
    exit 1
  }
item=$(OP_SERVICE_ACCOUNT_TOKEN=$sa op item get impz-mcp --vault zgeoff --reveal --format json)
field() { jq -er --arg label "$1" '.fields[] | select(.label == $label) | .value | select(. != "")' <<< "$item"; }
url=$(field url) || {
  echo "impz-mcp: no url in op://zgeoff/impz-mcp" >&2
  exit 1
}
token=$(field credential) || {
  echo "impz-mcp: no credential in op://zgeoff/impz-mcp" >&2
  exit 1
}
home="${XDG_STATE_HOME:-$HOME/.local/state}/impz-mcp"
mkdir -p "$home"
exec env -i HOME="$home" PATH="$PATH" IMP_URL="$url" IMP_TOKEN="$token" \
  impz mcp --prefix agent-
