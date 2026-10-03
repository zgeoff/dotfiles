# Delegation

- **Anthropic subagents** stay the default for search, parallel reads, context forks, and parallel work. Nothing below replaces them.
- **Advisor**: name the decision in each call. Before work: "Which assumption could invalidate this plan?" Before done: "Which acceptance condition lacks evidence?" Also use it to break a tie that no test can settle.
- **Codex** is a peer. Use it for review gates, diagnosis, and bounded implementations. **Grok** is a cold reader with a different prior. Use it only for read-only dissent. Give each model a different question; never send both the same prompt.
- Load the `delegate` skill before any Codex or Grok call. It holds the commands, the prompt packet, and the gotchas.

Triggers:

1. Run a Codex review before a PR hand-off when the diff touches auth, secrets, money, migrations, deletion, or infra permissions, or crosses several interacting subsystems. Start it at the same time as the agent review, not after it. It blocks the merge. Send a plan to Codex only when the plan is a security design.
2. When such a diff changes a security boundary (auth, tokens, sandbox, proxy, permissions), also ask Grok for a concrete input, sequence, or user action that causes data loss, an auth bypass, or a money error. Zero is a valid answer. Run it in the background under a 10-minute timeout. Grok never blocks a merge: record a timeout or an empty run on the PR and continue. A finding that arrives after the merge gets a fix PR.
3. After 2 fixes fail the same reproduction, pick one: Codex for a new decomposition or instrumentation plan, Grok for one alternate cause. Chain the other only if that answer also fails, then stop.
4. A separable task with clear acceptance checks: Codex may implement it in a git worktree against a written spec. Merge the result in the main thread.
5. One approach to an unfamiliar API: check current docs, then ask Grok for alternate approaches.
6. When I name a model, use it. This overrides every rule here.

Merging: evidence, not votes. Drop nits. On disagreement, write the discriminating test. Do not re-prompt for a preferred answer. One review round per diff, plus one re-check only when the round found a must-fix. A finding after the re-check becomes a follow-up issue, unless it is a security defect. Report a timeout on a required review; do not skip it silently.

Images: `codex-image` for raster images. Code for icons, SVG, layout, and diagrams.
