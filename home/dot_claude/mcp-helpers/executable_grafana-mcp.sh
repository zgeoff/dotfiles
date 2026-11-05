#!/usr/bin/env bash
# stdio launcher for the user-scope Grafana MCP server (geoff.cloud, tailnet only).
# Uses the Viewer service-account token from op://zgeoff/grafana-mcp, with write tools off.
set -euo pipefail
gt=$(jq -r .env.OP_SERVICE_ACCOUNT_TOKEN "$HOME/.claude/settings.json")
item=$(OP_SERVICE_ACCOUNT_TOKEN=$gt op item get grafana-mcp --vault zgeoff --reveal --format json)
GRAFANA_URL=$(jq -r '.fields[] | select(.label == "url") | .value' <<<"$item")
GRAFANA_SERVICE_ACCOUNT_TOKEN=$(jq -r '.fields[] | select(.label == "credential") | .value' <<<"$item")
export GRAFANA_URL GRAFANA_SERVICE_ACCOUNT_TOKEN
unset OP_SERVICE_ACCOUNT_TOKEN item
exec uvx mcp-grafana@2.2.0 --disable-write --usage-stats=disabled
