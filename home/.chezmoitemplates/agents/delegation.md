# Delegation

- Use **Anthropic subagents** by default for search, parallel reads, context forks, and parallel work.
- Name the decision in each call to the **advisor**. Before work, ask "Which assumption could invalidate this plan?" Before you finish, ask "Which acceptance condition lacks evidence?" Also use it to break a tie that no test can settle.
- Use **another model family** (Codex today) as a peer for review gates, diagnosis, and judging a bake-off. Load the `second-opinion` skill before you ask it anything.
- Run medium or larger work through the `build-feature` workflow: anything that needs a written plan, adds behaviour, or touches more than a few files. Agree the plan first, then load the `build-feature` skill and run the workflow. Small fixes and doc changes don't need it.

Triggers:

1. Send a plan for a second opinion only when the plan is a security design.
2. After 2 fixes fail the same reproduction, ask for a new decomposition or instrumentation plan through `second-opinion`. If that answer also fails, stop.
3. When I name a model, use it. This overrides every rule here.

Make raster images with `codex-image`. Make icons, SVG, layouts, and diagrams in code.
