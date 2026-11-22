# Subagent models

A subagent inherits the session model unless you name one. Pass `model` on every Agent call and on every agent a Workflow starts: `haiku` for mechanical work and lookups, `sonnet` for routine coding and searching, `opus` for complex reasoning, review and planning. Never leave `model` out. Pass `model: "fable"` only when I ask for a Fable subagent. A `subagent_type: "fork"` inherits the session model and ignores `model`, so use a fork only when I ask for one.

Write prose yourself. The main agent writes and rewrites docs, PR text, tickets and any other prose, and never hands it to a subagent of any model.

# Searching files

Use the Glob and Grep tools before `find`. They honour `.gitignore` and skip `node_modules`. In the agent shell, `find` is a shim over the bundled bfs engine, and it walks ignored directories, so a scan of a whole repo stats every file in `node_modules`. When only `find` will do, prune the directory: `-name node_modules -prune -o … -print`, never `-not -path "*/node_modules/*"`. `-not -path` only hides the matches from the output, and `find` still walks every file under the directory.
