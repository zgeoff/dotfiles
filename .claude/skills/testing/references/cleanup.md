# Cleanup

`onTestFinished` hooks run first-in, first-out, after every `afterEach` hook, the resets in the
[test preload](#the-test-preload) included. An `AsyncDisposableStack` runs its callbacks last-in,
first-out. A test that runs past its timeout still runs its cleanup. A run that something outside
stops, such as a CI job timeout, an out-of-memory kill or Ctrl-C, runs none. For the common case,
see [Cleanup](../SKILL.md#cleanup) in the testing skill.

- [The test preload](#the-test-preload)
- [Helpers that register cleanup](#helpers-that-register-cleanup)
- [Ordered cleanup](#ordered-cleanup)
- [Cleanup after the resets](#cleanup-after-the-resets)
- [Concurrent tests](#concurrent-tests)
- [A test that fails only in the full run](#a-test-that-fails-only-in-the-full-run)
- [Leftovers of a killed run](#leftovers-of-a-killed-run)

## The test preload

- Put each reset of shared state in an `afterEach` hook in the test preload, the file that
  `bunfig.toml` lists under `[test] preload`.
- Start a shared resource, such as the MSW server, in the preload's `beforeAll`, never at import.
- Import `updateEnv` and `removeEnvOverrides` from `@zgeoff/testing/helpers`. In a test, change an
  environment variable with `updateEnv`. In the preload, call `afterEach(removeEnvOverrides)`, which
  puts back each variable that `updateEnv` changed.

## Helpers that register cleanup

Call a helper that registers `onTestFinished` from inside a test, or from a `setupTest()` that a
test calls. At the top level of a test file, Bun throws
`Cannot call onTestFinished() outside of a test`.

Give each such helper a test that proves its cleanup ran. Call the helper, then register an
`onTestFinished` hook of your own that asserts. Your hook runs after the helper's, because it was
registered later:

```ts
test('it removes its checkout when the test finishes', async () => {
  const { dir } = await createTempCheckout();

  onTestFinished(() => {
    expect(existsSync(dir)).toBe(false);
  });
});
```

Say your proof hook reads a log folder that the helper keeps. Register the log folder's removal on
the line after your hook. The removal then runs after the hook.

This proof hook is the one place to assert outside the test body.

Skip the proof when the helper's cleanup only stops work that a passing test always waits for, such
as a build that the test awaits.

## Ordered cleanup

When one resource must close before another, put both on an `AsyncDisposableStack`. Register the
stack's disposal right after you create it. The stack closes the resources in the reverse of the
order you opened them. It runs every callback, even when one throws.

```ts
async function setupTest() {
  const stack = new AsyncDisposableStack();

  onTestFinished(() => stack.disposeAsync());

  const dir = await mkdtemp(join(tmpdir(), 'ledger-'));

  stack.defer(() => rm(dir, { recursive: true, force: true }));

  const db = new Database(join(dir, 'ledger.db'));

  stack.defer(() => db.close());
  applyLedgerMigrations(db);

  return { dir, db, stack };
}
```

- When you need another order, register one `stack.defer` callback that closes the resources in that
  order.
- Never hold the stack, or a resource on it, with `using` or `await using`. Either one disposes it
  when `setupTest()` returns, before the test uses it.
- Never call `move()` on the stack. It moves the callbacks to a new stack, and the registered
  disposal then closes nothing.
- When the test must shut a resource down before its next step, call the shutdown in the test body.
  Keep the stack's callback. Make the close safe to call twice, such as with a `closed` flag.
- Start each process that a test starts as the leader of its own process group, with
  `detached: true` in `Bun.spawn`. In cleanup, stop the whole group with
  `process.kill(-pid, 'SIGTERM')`, so a child it forks, such as a server, stops with it.
- When a test opens a listener only to read a free port, and the next statement stops it, register
  no cleanup for it.

## Cleanup after the resets

The preload's `afterEach` hooks run before `onTestFinished`. By then, `removeEnvOverrides` has put
back each variable that `updateEnv` changed. So when you point `HOME` at a temp folder, keep the
folder's path in a variable, and remove the folder through that variable:

```ts
const home = await mkdtemp(join(tmpdir(), 'notes-home-'));

updateEnv('HOME', home);
onTestFinished(() => rm(home, { recursive: true, force: true }));
```

Never read `process.env` in cleanup.

## Concurrent tests

Run a test that calls `onTestFinished` serially. Bun refuses `onTestFinished` in a `test.concurrent`
test. Never turn on `test.concurrent`, `--concurrent` or `concurrentTestGlob` for such a test.
Separate workers and CI jobs can still run in parallel.

## A test that fails only in the full run

When a test passes alone and fails beside others, another test leaves state behind. Find that test.
When it fails only under CI's `--randomize`, rerun with the printed `--seed=<seed>` first. Run each
step with the flags of the repo's test script:

1. Run the failing test file alone, and confirm it passes.
2. Run it with half of the other test files. Keep the half that still makes it fail, and halve it
   again, until one file is left.
3. In that file, find the state it never restores, such as a module cache, a singleton, a store or
   an override.
4. For module state, add its reset to the test preload. For a stored row or a file, give each test
   its own copy, as [Database testing](./database.md) describes.

Never reorder the tests. That hides the leak until a later test fails on it.

## Leftovers of a killed run

When something kills a run, its temp folders and database clones stay behind. On a host where `/tmp`
or the database's data sits on tmpfs, each leftover holds RAM.

Start the name of each folder and database clone that a run makes with a prefix, such as
`pid4182-ns4026531836-`. Build it from the PID of the test process that made it and that process's
PID namespace. On Linux, `readlink /proc/self/ns/pid` prints `pid:[<namespace>]`. A sandbox with its
own PID namespace can share the temp folder, and there the same PID belongs to another process.

Then sweep at the start of each run, in the repo's test script before `bun test` starts, so the
sweep runs once per run. Remove each leftover from the sweep's own namespace whose PID no longer
runs, and never touch a leftover from another namespace. `process.kill(pid, 0)` throws `ESRCH` when
the process is gone. Treat any other error, such as `EPERM` for another user's process, as a process
that still runs. The sweep removes:

- temp folders, such as a test's `HOME`;
- the database clones that the test-database helper makes, as
  [Postgres isolation](./database.md#postgres-isolation) describes;
- templates whose hash no longer matches their inputs, as
  [Per-run templates](./slow-tests.md#per-run-templates) describes.

Never remove the template for the current hash, or anything a run that is still going uses. Test the
sweep on what it must keep, such as `it never removes the files of a run that is still going`.
