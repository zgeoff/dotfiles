#!/usr/bin/env bash
# headersHelper for the user-scope Axiom MCP server.
# Prints the auth headers as JSON on stdout. Reads the query-only token from
# op://zgeoff/axiom-mcp with the global service account, so it works in every repo,
# even where settings.local.json swaps OP_SERVICE_ACCOUNT_TOKEN for a repo profile.
# Exits non-zero, with nothing on stdout, when a field is missing or empty.
set -euo pipefail
item=$(OP_SERVICE_ACCOUNT_TOKEN=$(jq -er .env.OP_SERVICE_ACCOUNT_TOKEN "$HOME/.claude/settings.json") \
  op item get axiom-mcp --vault zgeoff --reveal --format json)
jq -ec '
  def field($label): [.fields[] | select(.label == $label) | .value | select(. != null and . != "")][0];
  (field("credential") // error("no credential in op://zgeoff/axiom-mcp")) as $token
  | (field("org-id") // error("no org-id in op://zgeoff/axiom-mcp")) as $org
  | {"Authorization": ("Bearer " + $token), "x-axiom-org-id": $org}
' <<<"$item"
