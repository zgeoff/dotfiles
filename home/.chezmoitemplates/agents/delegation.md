# Delegation

- **Anthropic subagents** stay the default for search, parallel reads, context forks, and parallel work. Nothing below replaces them.
- **Advisor**: name the decision in each call. Before work: "Which assumption could invalidate this plan?" Before done: "Which acceptance condition lacks evidence?" Also use it to break a tie that no test can settle.
- **Codex** is a peer. Use it for review gates, diagnosis, and bounded implementations.
- Load the `delegate` skill before any Codex call. It holds the commands, the prompt packet, and the gotchas.
- Medium or larger work runs through the `build-feature` workflow: anything that needs a written plan, adds behaviour, or touches more than a few files. Agree the plan first, then load the `build-feature` skill and run the workflow. Small fixes and doc changes don't need it.

Triggers:

1. Send a plan to Codex for review only when the plan is a security design.
2. After 2 fixes fail the same reproduction, ask Codex for a new decomposition or instrumentation plan. If that answer also fails, stop.
3. A separable task with clear acceptance checks: Codex may implement it in a git worktree against a written spec. Merge the result in the main thread.
4. When I name a model, use it. This overrides every rule here.

Images: `codex-image` for raster images. Code for icons, SVG, layout, and diagrams.
