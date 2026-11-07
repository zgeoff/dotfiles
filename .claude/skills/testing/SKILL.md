---
name: testing
description:
  Testing rules for zgeoff repos, covering where a test lives, test shape, setupTest and cleanup,
  test data, stored state seeded and read through the module that creates it, schemas, assertions,
  matchers, time, boundaries and speed. References cover seeding, slow tests and lanes, factories,
  databases, HTTP mocking, cleanup, observability, system tests, shell scripts, workflows and Claude
  Code mods, plus frontend, Go and NixOS where a repo uses them. Load it before you write or review
  a test. Load the repo's project-testing skill beside it, for the lanes and utils in its Facts
  table, and for its stand-ins; where they disagree, the project skill wins.
metadata:
  kind: rule-set
---

# Testing

## References

- [Seeding](./references/seeding.md): a seed, a seeder, and where to write rows directly.
- [Slow tests and lanes](./references/slow-tests.md): a slow test, the run mode, and a lane.
- [Factories](./references/factories.md): writing a factory.
- [Matchers](./references/matchers.md): a matcher for a kind of value.
- [Schemas and access rules](./references/schemas-and-access.md): a test of a schema, a parser or an
  access rule.
- [Boundaries](./references/boundaries.md): the stand-in for each boundary, and module mocks.
- [Database](./references/database.md): a package that owns a schema.
- [HTTP mocking](./references/http.md): a package that calls a remote service.
- [Cleanup](./references/cleanup.md): a reset in the test preload, cleanup order, or a test that
  fails only in the full run.
- [Observability](./references/observability.md): code that records telemetry.
- [System tests](./references/system-tests.md): placing a test, and writing an end-to-end,
  evaluation, property or golden test.
- [Shell scripts](./references/shell.md): a script's test.
- [Workflows](./references/workflows.md): testing a GitHub Actions step's logic, or checking a
  config file.
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
- Give each behaviour you add or change a test through the function the unit's callers call. Check
  that the test fails when you revert the change.
- Test the behaviour, so a refactor that keeps it leaves every test green.
- Bring each test you edit in line with these rules.
- Never cut a test that checks behaviour. Never add one that checks nothing.

## Where a test lives

- Put a test beside the module or script it tests: `src/record-payment.test.ts`.
- Look for a shared helper in
  [`@zgeoff/testing/helpers`](https://github.com/zgeoff/tools/tree/main/packages/testing) first. Put
  a new one, with its own test beside it, in `src/test-utils/` of the package that owns what the
  helper starts, builds or fakes.
- Put an end-to-end test, an evaluation and a benchmark of a running program where
  [Package layout](./references/system-tests.md#package-layout) shows.

[`chex test-layout`](https://github.com/zgeoff/tools/tree/main/packages/chex) fails a test outside
this layout.

## Test shape

- Write top-level `test()` calls, with no `describe`. Hooks in a `describe` couple its tests.
- Name the behaviour a caller sees in each title, as verb, outcome, condition:
  `it rejects a title longer than 120 characters`. In a file that tests several units, put the unit
  in place of `it`: `#archiveNote rejects …`.
- Arrange, act, assert, with no phase comments. Write one act per test. Treat an earlier act the
  test depends on, such as saving the note it archives, as arrangement, and don't assert on it.
- Use `test.each` only for cases that differ in values, with rows of plain data or seed functions.
  Put the value that varies in the title.
- Never loop over assertions: the failure doesn't name the case. Use `test.each`, or one collection
  matcher: `expect(listOpenNotes(store)).toSatisfyAll((note: Note) => note.archivedAt === null)`.

## setupTest

- Put per-test setup in one local `setupTest()` that each test calls, and no hook such as
  `beforeEach` in a test file.
- In `setupTest()`, wire the temp directories, the database, the clock, servers, clients, telemetry
  recorders, the unit, and the [seeder](./references/seeding.md#buildseeder-and-setuptest). Create
  no data there. Give it no `if`, and no argument that a test's outcome depends on.
- Create each test's data in the test, even when every test needs the same. Set the time in each
  test whose code reads it.
- Declare only imports, `setupTest()` and tests at module level.
- Keep each function that `setupTest()` returns, other than the seeder, to calls of production code,
  such as `readNotes: () => listNotes(db)`.
- Write one `setupTest()` per file, and never share it. Bind its result to one `const ctx`, never
  destructured.

```ts
async function setupTest() {
  const db = await createTestDatabase();
  const deps = { db, clock: buildStubClock() };

  return { ...deps, service: createNotesService(deps), seed: buildSeeder(deps) };
}

test('it lists the notes of a user with none as empty', async () => {
  const ctx = await setupTest();
  const user = await ctx.seed.user({ name: 'ada' });

  expect(await ctx.service.listNotes({ userID: user.id })).toStrictEqual([]);
});
```

## Cleanup

- Register `onTestFinished` right after each acquisition, so a later throw still releases it. No
  `try`/`finally` in a test.
- When a test changes process state that the
  [test preload](./references/cleanup.md#the-test-preload) doesn't reset, register `onTestFinished`
  right after the change.
- When you add state to production code that outlives a test, such as a cache, reset it in the test
  preload.
- Override an environment variable with `updateEnv` from `@zgeoff/testing/helpers`, never by
  assigning `process.env`.
- Keep tests apart with the [test-database helper](./references/database.md) and a folder per test,
  never with random IDs: a list query still returns the other test's rows.

## Test data

- Keep plain inputs inline: write the literal again in the next test, never a shared fixture or a
  named constant.
- When a test needs a type that crosses a module boundary, such as an SDK result, write a tested
  `buildMock<Type>` [factory](./references/factories.md) for it in `src/test-utils/`. Build only
  plain data in a factory.
- Build a stand-in for a boundary from data only, in one of the forms
  [Stand-ins](./references/boundaries.md#stand-ins) lists. Move any logic in a stand-in to a tested
  helper in `src/test-utils/`.

## Stored state

Seed and read database rows and files on disk through the module that creates them, even in tests of
a module that only changes them. Write them directly only where [Seeding](./references/seeding.md)
allows.

- Outside the creating module's tests, read through its code: a read function for rows, a path
  helper for files. When none exists, add one, with a test.
- Seed through the module, with one seed per state, such as
  `ctx.seed.archivedNote({ title: 'Groceries' })`. Keep the call under test and each clock move in
  the test, as [Seeding](./references/seeding.md) says.

## Assertions

- Assert the full contract with `toStrictEqual`, with an asymmetric matcher for a field the test
  doesn't decide, such as a generated ID. Never use `toEqual`. Use `toMatchObject` only for an
  error's code, or a raw row in the creating module's own test. When you read stored state back
  after a change, one `toBe` on the changed field is enough.
- Assert each result in its own `expect`, and the parts of one result in one `expect`, such as a
  command's exit code, stdout and stderr.
- Derive the expected value from the contract, never with the unit's own calculation.

## Errors

- Assert only as much of the error as callers rely on: `toThrow()`,
  `toThrowWithMessage(Error, /…/)`, or `toMatchObject({ code })`.
- Test each error that the unit throws or returns on purpose. For a throw that can't happen in
  production, delete the branch, or write `invariant()` from `tiny-invariant`.
- Never assert in a `try`/`catch`: when nothing throws, nothing is asserted.
- Write `.rejects` and `.resolves` without `await`: Bun settles the promise inside the matcher.
  Always `await` `toResolve()` and `toReject()`.

## Narrowing

- Never branch in a test body. Give each path its own test.
- When you assert on a field of a value that may be missing:
  - With `toBeUndefined`, `toBeFalsy`, `toBeNil` or a `.not` matcher, write `invariant(value)`
    first, then assert on `value.field`. These matchers pass on `undefined`, so `value?.field` hides
    a missing value.
  - With any other matcher, assert on `value?.field`. A missing value fails that matcher.
- To check that the value is absent, assert on it, with no `invariant`.
- Copy a value out of a callback and assert after the call returns: an assertion in a callback that
  never runs passes.

## Matchers

Use a [jest-extended matcher](./references/matchers.md) over a hand-written check, such as
`toSatisfyAll(isOpen)`. The matcher prints the received value.

## Time and waiting

- Control time in the most explicit form the code allows:
  1. an argument: `expireSessions(store, { now })`;
  2. an injected clock: `ctx.clock.advance(30_000)`;
  3. fake timers, for code the repo doesn't own, restored in `onTestFinished`.
- When you can't pass the time in, assert a range around `Date.now()`, such as `toBeWithin`.
- Wait on a condition with `waitFor` from `@zgeoff/testing/helpers`, never a sleep. When the code
  has nothing to wait on, add a signal, such as an event.

## Boundaries

- Pass plain values to code that does no I/O. Answer a remote service's requests with
  [MSW](./references/http.md), and run database code against a
  [real database](./references/database.md).
- Never stub `fetch`, an HTTP client or the unit's own services.
- Pass every path in from the test's `mkdtemp` folder. Never steer a module through `process.cwd()`
  or a `HOME` set after startup.
- Reach a failure branch with a real failure, as
  [Failure branches](./references/boundaries.md#failure-branches) shows.
- Never call `mock.module` in a test file. It leaks into every later file in the worker.

## Speed

- Keep each unit test under 5 s on CI. Fix a slower one from the
  [slow-tests table](./references/slow-tests.md), never by raising the timeout.
