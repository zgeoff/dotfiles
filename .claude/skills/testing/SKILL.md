---
name: testing
description:
  Testing rules for zgeoff repos, covering where a test lives, test shape, setupTest and cleanup,
  test data, stored state seeded and read through the module that creates it, schemas, assertions,
  matchers, time, boundaries and speed. References cover seeding, slow tests and the command that
  runs each kind of test, factories, databases, HTTP mocking, cleanup, observability, system tests,
  shell scripts, workflows and Claude Code mods, plus frontend, Go and NixOS where a repo uses them.
  Load it before you write or review a test. Load the repo's project-testing skill beside it, for
  the test commands and utils in its Facts table, and for its stand-ins; where they disagree, the
  project skill wins.
metadata:
  kind: rule-set
---

# Testing

## References

- [Seeding](./references/seeding.md): seeds, seeders, and direct row writes.
- [Slow tests](./references/slow-tests.md): a slow test, and each test command.
- [Factories](./references/factories.md): a factory.
- [Matchers](./references/matchers.md): a matcher per kind of value.
- [Schemas and access rules](./references/schemas-and-access.md): a schema, a parser or an access
  rule.
- [Boundaries](./references/boundaries.md): the stand-in for each boundary, and module mocks.
- [Database](./references/database.md): a package that owns a schema.
- [HTTP mocking](./references/http.md): a package that calls a remote service.
- [Cleanup](./references/cleanup.md): a reset in the test preload, cleanup order, or a leak between
  test files.
- [Observability](./references/observability.md): code that records telemetry.
- [System tests](./references/system-tests.md): placing a test, and an end-to-end, evaluation,
  property or golden test.
- [Shell scripts](./references/shell.md): a script's test.
- [Workflows](./references/workflows.md): a GitHub Actions step's logic, or a config file check.
- [Claude Code mod checks](./references/claude-code-mods.md): a mod's hooks.

<!-- repo-sync needs ./references/frontend.md -->

- [Frontend](./references/frontend.md): React and TanStack clients in a web app.

<!-- repo-sync end -->

<!-- repo-sync needs ./references/go.md -->

- [Go testing](./references/go.md): Go tests.

<!-- repo-sync end -->

<!-- repo-sync needs ./references/nixos.md -->

- [NixOS testing](./references/nixos.md): Nix evaluation and VM tests.

<!-- repo-sync end -->

## Principles

- Write each test so a reader understands it from its body alone.
- Make each test pass alone and in any order.
- Test each behaviour you add or change. Call the function that the unit's callers call. Check that
  the test fails when you revert the change, or when you break the code it covers.
- Test the behaviour, so a refactor that keeps it leaves every test green.
- Bring each test you edit in line with these rules.
- Never cut a test that checks behaviour. Never add one that checks nothing.

## Where a test lives

Here a module is one source file, and the unit is the code a test calls.

- Put a test beside the module or script it tests: `src/record-payment.test.ts`.
- Look for a shared helper in
  [`@zgeoff/testing/helpers`](https://github.com/zgeoff/tools/tree/main/packages/testing) first. Put
  a new one, with its own test, in `src/test-utils/` of the package that owns what it starts, builds
  or fakes.
- Put any other kind of test, such as an end-to-end test, where
  [Package layout](./references/system-tests.md#package-layout) shows.
- Without a project-testing skill, take each test's command from
  [Where each test runs](./references/slow-tests.md#where-each-test-runs).
- Run [`bun x @zgeoff/chex test-layout`](https://github.com/zgeoff/tools/tree/main/packages/chex)
  after you add a test file.

## Test shape

- Write top-level `test()` calls, with no `describe`. Hooks in a `describe` couple its tests.
- Name the behaviour a caller sees in each title, as verb, outcome, condition:
  `it rejects a title longer than 120 characters`. In a file that tests several units, write `#` and
  the unit's name in place of `it`: `#archiveNote rejects …`.
- Arrange, act, assert, with no phase comments. Write one act per test. Treat an earlier act the
  test depends on, such as saving the note it archives, as arrangement, and don't assert on it.
- Use `test.each` only for cases that differ in values, with rows of plain data or
  [seed functions](./references/seeding.md#table-driven-tests). Put the value that varies in the
  title.
- Never loop over assertions, beyond the cases
  [Property tests](./references/system-tests.md#property-tests) allows: you can't tell which case
  failed. Use `test.each`, or one collection matcher, such as `toSatisfyAll`.

## setupTest

- Put per-test setup in one local `setupTest()` that each test calls, never a hook such as
  `beforeEach`.
- In `setupTest()`, wire the unit and what it needs, such as the test's temp folder, the database,
  the clock and the [seeder](./references/seeding.md#buildseeder-and-setuptest). Leave the MSW
  server to the [test preload](./references/http.md#the-server-and-its-lifecycle).
- Give `setupTest()` no `if`, and no argument that decides the outcome, such as a record's state.
  The reader must see that in the test.
- Create each test's data in the test, even when every test needs the same. Set the time in each
  test whose code reads it.
- Declare only imports, `setupTest()` and tests at module level.
- Make each function that `setupTest()` returns, other than the seeder, only call production code,
  such as `readNotes: () => listNotes(db)`.
- Write one `setupTest()` per file, and never share it. Bind its result to one `const ctx`, never
  destructured.

Both helpers below live in the repo's `src/test-utils/`.

```ts
async function setupTest() {
  const db = await createTestDatabase('transaction');
  const deps = { db, clock: buildStubClock() };

  return { ...deps, service: createNotesService(deps), seed: buildSeeder(deps) };
}

test('it lists the notes of a user with none as empty', async () => {
  const ctx = await setupTest();
  const user = await ctx.seed.user();

  expect(await ctx.service.listNotes({ userID: user.id })).toStrictEqual([]);
});
```

## Cleanup

- Register `onTestFinished` right after you open a resource, such as a server or a temp folder, so a
  later throw still closes it. No `try`/`finally` in a test.
- Reset state that outlives a test, such as a cache or a changed process setting, as
  [The test preload](./references/cleanup.md#the-test-preload) says. Change an environment variable
  only with `updateEnv` from `@zgeoff/testing/helpers`.
- Keep tests apart with the repo's [test-database helper](./references/database.md) and a temp
  folder per test, never with random IDs: a list query still returns the other test's rows.

## Test data

- Keep plain inputs inline: write the literal again in the next test, never a shared fixture or a
  named constant.
- For a type that crosses a module boundary, such as an SDK result, write a tested `buildMock<Type>`
  [factory](./references/factories.md) in `src/test-utils/`. It builds only plain data, and is no
  stand-in.

## Stored state

Seed and read database rows and files through the module that creates them, even in tests of a
module that only changes them, such as `approve-invoice.ts` beside `create-invoice.ts`. Write them
directly only where [Seeding](./references/seeding.md) allows.

- Outside the creating module's tests, read through its read function, and get a file's path from
  its path function. When none exists, add one, with a test.
- Seed only the state the test starts in, with one seed per value of the module's state type, such
  as `ctx.seed.archivedNote()`. Make the call under test and each clock move in the test body.

## Assertions

- Assert the full contract with `toStrictEqual`, never `toEqual`. Put an asymmetric matcher in it
  for a field the test doesn't decide, such as a generated ID.
- Use `toMatchObject` only for an error's code, or for a raw row in the creating module's own test.
- Assert each result in its own `expect`, such as a call's return value and the stored state you
  read back. For that read-back, one `toBe` on the changed field is enough.
- Assert the parts of one result in one `expect`, such as a command's exit code, stdout and stderr.
- Derive the expected value from the contract, never with the unit's own calculation.
- Use a [jest-extended matcher](./references/matchers.md) over a hand-written check: it prints the
  received value.

## Errors

- Assert only as much of the error as callers rely on: `toThrow()`,
  `toThrowWithMessage(Error, /…/)`, or `toMatchObject({ code })`.
- Test each error that the unit throws or returns on purpose. For a throw that can't happen in
  production, delete the branch, or write `invariant()` from `tiny-invariant`.
- Never assert in a `try`/`catch`: when nothing throws, nothing is asserted.
- Write `.rejects` and `.resolves` without `await`, and always `await` `toResolve()` and
  `toReject()`. On a promise that waits on a Worker, use
  [`Promise.allSettled`](./references/matchers.md#a-promise-that-waits-on-a-worker).

## Narrowing

- Never branch in a test body. Give each path its own test.
- Copy a value out of a callback, and assert after the call returns. An assertion in a callback that
  never runs passes.
- Narrow a [value that may be missing](./references/matchers.md#a-value-that-may-be-missing) before
  you assert on its field.

## Time and waiting

- Control time in the most explicit form the code allows:
  1. an argument: `expireSessions(store, { now })`;
  2. an injected clock: `ctx.clock.advance(30_000)`;
  3. fake timers, to move time forward in code the repo doesn't own, restored in `onTestFinished`.
- When you can't pass in a time the code records, assert a range around `Date.now()`, such as
  `toBeWithin`.
- Wait on a condition with `waitFor` from `@zgeoff/testing/helpers`, never a sleep. When the code
  has nothing to wait on, add a signal, such as an event.

## Boundaries

- Pass plain values to code that does no I/O. Answer a remote service's requests with
  [MSW](./references/http.md), and run database code against a
  [real database](./references/database.md).
- Never stub `fetch`, an HTTP client, or a service from the repo that the unit calls. Stub only an
  SDK client's single `send` method, as [Boundaries](./references/boundaries.md) says, and use MSW
  for any other SDK client.
- Pass every path in from the test's temp folder. Never let a module find a path through
  `process.cwd()` or a `HOME` changed after the module loads.
- Reach a failure branch with a real failure, as
  [Failure branches](./references/boundaries.md#failure-branches) shows.
- Never call `mock.module` in a test file. It leaks into every later file in the worker.

## Speed

- Keep each test of `bun run test` under 5 s on CI. Fix a slower one from
  [Causes and fixes](./references/slow-tests.md#causes-and-fixes), never with a longer timeout.
