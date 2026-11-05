#!/usr/bin/env bash
# headersHelper for the user-scope Axiom MCP server.
# Prints the auth headers as JSON on stdout. Reads the query-only token from
# op://zgeoff/axiom-mcp with the global service account, so it works in every repo,
# even where settings.local.json swaps OP_SERVICE_ACCOUNT_TOKEN for a repo profile.
set -euo pipefail
export OP_SERVICE_ACCOUNT_TOKEN
OP_SERVICE_ACCOUNT_TOKEN=$(jq -r .env.OP_SERVICE_ACCOUNT_TOKEN "$HOME/.claude/settings.json")
item=$(op item get axiom-mcp --vault zgeoff --reveal --format json)
jq -c '{
  "Authorization": ("Bearer " + (.fields[] | select(.label == "credential") | .value)),
  "x-axiom-org-id": (.fields[] | select(.label == "org-id") | .value)
}' <<<"$item"
