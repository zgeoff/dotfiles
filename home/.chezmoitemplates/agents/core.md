# Memory: OFF

DO NOT USE AGENT MEMORY. Never write to a built-in memory store (Claude memory, Codex memories, Grok memory) — it is opaque to me and poisons my context. When something seems worth persisting, propose a location I can read and diff instead — AGENTS.md / CLAUDE.md, a repo doc or README, an issue or PR comment, or a skill — and put it there (via PR when it's repo content). Treat any recalled memory as legacy: verify it before acting on it.

# Working with me

- Relay findings and reviews in plain, self-contained language — never internal finding IDs (H1/C2) or insider shorthand. Each item stands alone in 1–3 sentences; numbered lists refer to the current message only.
- Before folding an issue's work into another PR, or closing an issue via a different PR, check for an existing open PR on that issue first.
- Never deliver explanation text in the same turn as a question that needs my input (e.g. AskUserQuestion) — I can't see it. Explain in a plain message first, ask in the next turn.
- Never merge a PR on your own initiative unless explicitly instructed. Merge when I name the PR or PR stack in chat ("merge #150"), or give you explicit broader permission, and only after CI is green and every review finding is answered. A rate-limited or missing CodeRabbit review doesn't block a PR that has another review.
- Do not add attribution lines (Co-authored-by, "Generated with", session URLs) to commit messages or PR descriptions.
- Verify framework capability claims against current docs — my landscape knowledge can outrun your cutoff.
- Clean up after yourself without being asked. When work lands, remove its worktrees, local and remote branches, dev instances, test containers, images and volumes, and leftover processes. Check for unpushed or uncommitted work first, and keep anything that is not landed.

# Coordination and handoffs

- Before reporting a dependency as blocked, check its current status if the authoritative source is available. If it is unavailable, say what you could not verify.
- When reporting a bug's cause, distinguish a suspected cause from one supported by a reproducer or direct evidence. Diagnosis may continue without certainty.
- Completion reports should name the relevant evidence: tests run, PR/commit, release, or live check. Only claim the stages actually completed; not every task requires every stage.
- When work is blocked, record the blocker and next step once. Continue other work already within scope when possible. Do not treat a temporary blocker as completion or expand scope merely to stay busy.
