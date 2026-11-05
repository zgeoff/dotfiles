#!/usr/bin/env bash
# stdio launcher for the user-scope Grafana MCP server (geoff.cloud, tailnet only).
# Uses only the Viewer service-account token from op://zgeoff/grafana-mcp, with write tools off,
# in a clean environment so no other credential in the parent environment reaches the server.
set -euo pipefail
sa=$(jq -er '.env.OP_SERVICE_ACCOUNT_TOKEN | select(. != "")' "$HOME/.claude/settings.json") ||
  { echo "grafana-mcp: no OP_SERVICE_ACCOUNT_TOKEN in ~/.claude/settings.json" >&2; exit 1; }
item=$(OP_SERVICE_ACCOUNT_TOKEN=$sa \
  op item get grafana-mcp --vault zgeoff --reveal --format json)
field() { jq -er --arg label "$1" '.fields[] | select(.label == $label) | .value | select(. != "")' <<<"$item"; }
url=$(field url) || { echo "grafana-mcp: no url in op://zgeoff/grafana-mcp" >&2; exit 1; }
token=$(field credential) || { echo "grafana-mcp: no credential in op://zgeoff/grafana-mcp" >&2; exit 1; }
exec env -i HOME="$HOME" PATH="$PATH" GRAFANA_URL="$url" GRAFANA_SERVICE_ACCOUNT_TOKEN="$token" \
  uvx mcp-grafana@2.2.0 --disable-write --usage-stats=disabled
