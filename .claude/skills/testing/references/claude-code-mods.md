# Claude Code mod checks

Test a Claude Code mod's hooks with checks that run inside the Claude Code host, because the hooks
run there, not under Bun. Bun's test preload, its matchers and its module mocks don't work in a
check, and a check can't import faker, jest-extended, MSW or `invariant`. Never assert a message
that a hook throws: the host swallows it. Answer each host event from a check synchronously: the
host reads a handler that returns a promise as no answer. The testing skill's
[Principles](../SKILL.md#principles), [Test data](../SKILL.md#test-data) and
[Assertions](../SKILL.md#assertions) still apply, with the changes in
[What changes in a check](#what-changes-in-a-check).

- [Running checks](#running-checks)
- [The claude-code/testing module](#the-claude-codetesting-module)
- [What changes in a check](#what-changes-in-a-check)
- [Thrown errors](#thrown-errors)
- [Time](#time)

## Running checks

- Name a check after the hook module it tests, `<hook>.claude-check.ts`, and put it beside that
  module. `bun test` never collects it, because `bun test` can't host a hook.
- Run the checks through the repo's `package.json` script for them, such as `check:claude-mod`. To
  find it, search `package.json` and `scripts/` for `plugin test`.
- Never run `claude plugin test` on the mod folder by hand. It collects only `*.test.ts` and
  `*.test.tsx`, so it finds no check, and it runs with your own Claude Code configuration and
  plugins.
- When the repo has no such script, write one in `scripts/`. Copy the mod to a temp folder, rename
  each `*.claude-check.ts` there to `*.test.ts`, and run `claude plugin validate` and
  `claude plugin test` on the copy. Pass an environment that holds only `PATH`, with
  `CLAUDE_CONFIG_DIR` set to a folder inside the temp folder, so no installed plugin reaches a
  check.
- In a check, import only the mod's own files, by relative path, and `claude-code` modules, such as
  `claude-code/testing`. The host fails the file on any other import.

## The claude-code/testing module

Import `expect`, `test` and, when you need it, `mock` from `claude-code/testing`. Never use
`describe`: the testing skill bans it in Bun tests too.

- Write a test as `test(name, ($, on) => …)`. `$` is the host API that the hooks call.
- To pass options, write `test(name, { timeoutMs, options, plugins }, ($, on) => …)`. `timeoutMs`
  defaults to 5000. `options` holds the mod's `userConfig` values, and `plugins` loads other plugins
  beside the mod.
- Register a stand-in for a host event with `on`, such as `on('process.run', …)`. The host calls
  your handler after the handlers of every plugin, in place of its built-in one. When no handler
  answers an event, the call rejects with `no implementation for <event>`.
- Return the type that `.claude-plugin/types/claude-code/index.d.ts` gives as the event's result.
  Some events take the value itself, and others take `{ value }`, such as `process.run` in the
  sample below.
- Expect a fresh host in each test. Module state and registered handlers don't carry from one test
  to the next, so a check needs no resets.

`mock` is an object of helpers, not a function you call:

- `mock.store(on, entries)` answers `$.store` from a record of keys and values.
- `mock.env(on, variables)` answers `$.env.get` from a record of names and strings. A name you leave
  out reads as unset.
- `mock.session(on)` returns an object whose `appended()` lists the rows that plugins appended to
  the session.
- `mock.clock(on, { now })` exists, but never use it in a mod check, as [Time](#time) says.

The module lacks these Bun features:

- `test.each`;
- a `mock()` call recorder;
- `onTestFinished`;
- `beforeAll`, `beforeEach`, `afterEach` and `afterAll`;
- the jest-extended matchers, except `toStartWith` and `toEndWith`.

It has the core matchers, such as `toStrictEqual` and `toMatchObject`.

Keep a `testing.d.ts` in the mod's `hooks/` folder, and commit it. Declare `claude-code/testing` in
it with only what the real module offers, each signature copied from
`.claude-plugin/types/claude-code/index.d.ts` in the mod's folder. A member that the real module
lacks passes the typecheck and fails at run time. The host writes `index.d.ts` only when it loads
the mod from a folder you own, and repos git-ignore it, so CI never has it. To get it, load the mod
in Claude Code from your own checkout.

## What changes in a check

- Write a separate test for each row of a fixed table of cases, because the module has no
  `test.each`.
- Record calls in an inline array that an `on(…)` handler fills, and assert the array after the act
  returns.
- Narrow a value that may be missing with a small `assertDefined` in `hooks/test-utils/`, with its
  own check.
- Give each factory fixed defaults, with a comment that faker can't load in a check.
- Put shared check helpers, factories and stand-ins in `hooks/test-utils/`, each with its own check.
  List `hooks/test-utils/` and `*.claude-check.ts` in the mod's `.npmignore`, so the published
  package carries neither.

```ts
import { expect, test } from 'claude-code/testing';
import { buildMockPermissionDecision } from './test-utils/factories/build-mock-permission-decision.ts';
import { buildMockProcessResult } from './test-utils/factories/build-mock-process-result.ts';

test('it runs the classifier once for an ask', async ($, on) => {
  const runs: (readonly string[])[] = [];

  on('tool.check', () => buildMockPermissionDecision({ decision: 'ask' }));
  on('process.run', (_api, input) => {
    runs.push(input.argv);

    return { value: buildMockProcessResult({ stdout: '{"decision":"allow"}' }) };
  });

  await $.tool.check({ tool: 'Bash', input: { command: 'git push' } });

  expect(runs).toHaveLength(1);
});
```

## Thrown errors

When a hook throws, the host skips that hook and runs the rest of the chain. The caller gets the
host's own error, such as `no implementation for process.run`. The thrown message shows only in the
failure report, under `the engine reported`, so a check can't assert it.

When a branch shows only in its thrown message, name the branch in a comment on the `throw`. A
reader of the hook then knows that no check covers it.

## Time

In a mod, never read the time with `$.clock.now()`, and never use `mock.clock` in its checks. Any
installed plugin can hook `clock.now`, so another plugin could move a deadline or a recorded start
time. A rejected call also adds failure paths that the mod must handle.

So in a mod, the testing skill's [Time and waiting](../SKILL.md#time-and-waiting) order drops the
injected clock:

1. Pass the time in as an argument, where the function allows it.
2. Otherwise, read `Date.now()`. Use it for a deadline that the mod passes to a child process,
   because a `performance.now()` value means nothing in another process.

In a check of code that reads `Date.now()`, capture `Date.now()` before and after the act. Assert
the value with `toBeGreaterThanOrEqual` and `toBeLessThanOrEqual` against those two.
