#!/usr/bin/env bash
# stdio launcher for the user-scope Fly MCP server.
# Runs `fly mcp server` with only the read-only org token from op://zgeoff/fly-mcp,
# in its own config dir, so your own `fly auth login` session never reaches the agents.
set -euo pipefail
gt=$(jq -r .env.OP_SERVICE_ACCOUNT_TOKEN "$HOME/.claude/settings.json")
FLY_ACCESS_TOKEN=$(OP_SERVICE_ACCOUNT_TOKEN=$gt op read op://zgeoff/fly-mcp/credential)
export FLY_ACCESS_TOKEN
export FLY_CONFIG_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/fly-mcp"
mkdir -p "$FLY_CONFIG_DIR"
unset OP_SERVICE_ACCOUNT_TOKEN
exec fly mcp server
