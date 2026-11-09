# System tests

Never sleep to let a service settle. Wait on a condition. Never overwrite, truncate, mount or delete
a host resource that this run didn't create. Never put `#[ignore]` on a Rust test that needs a real
system: give it the module and the nextest profile from
[Rust tests that need a real system](#rust-tests-that-need-a-real-system). Every profile skips an
ignored test, and nothing reports that the test stopped running.

These rules add to the [testing skill](../SKILL.md). They cover where each kind of test lives, a
test that runs a whole program, a browser or a VM, and a test that touches something the whole host
shares, such as a kernel timer or a fixed path.

- [Package layout](#package-layout)
- [End-to-end suites](#end-to-end-suites)
- [Real applications and transport](#real-applications-and-transport)
- [Stateful stand-ins](#stateful-stand-ins)
- [Browser suites](#browser-suites)
- [Native timers and scenario delays](#native-timers-and-scenario-delays)
- [Property tests](#property-tests)
- [Evaluation suites](#evaluation-suites)
- [Benchmarks](#benchmarks)
- [Golden tests](#golden-tests)
- [Program-fixed paths and global resources](#program-fixed-paths-and-global-resources)
- [Rust tests that need a real system](#rust-tests-that-need-a-real-system)

## Package layout

Lay out each package like this made-up one:

```text
packages/ledger/
├── package.json                    exports "./test-utils/*"
├── src/
│   ├── record-payment.ts
│   ├── record-payment.test.ts      unit test, beside its module
│   ├── record-payment.bench.ts     benchmark of one module
│   ├── render-pdf.browser.test.ts  unit test that bun run test:browser runs
│   └── test-utils/
│       ├── start-ledger.ts         helper, with its own test
│       └── start-ledger.test.ts
├── e2e/
│   ├── start-ready.test.ts         the built program, run as a process
│   ├── journey-checkout.test.ts
│   └── fixtures/                   inputs that aren't code, such as a Dockerfile
├── evals/
│   └── categorise/                 one folder per evaluation
└── bench/
    └── import-statement.bench.ts   benchmark of the running program
```

Export the helpers from `package.json` as `"./test-utils/*": "./src/test-utils/*.ts"`, so other
packages' tests import them.

| The test                                                                                                                        | Put it                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| starts, as a process, a program that `rig.config.ts` declares for [rig](https://github.com/zgeoff/tools/tree/main/packages/rig) | in `e2e/` of the package that builds the program, named with a prefix from [End-to-end suites](#end-to-end-suites) |
| scores a corpus                                                                                                                 | in `evals/<name>/` of the package whose code it scores, as [Evaluation suites](#evaluation-suites) shows           |
| measures a running program                                                                                                      | in `bench/` of the package that builds the program, as [Benchmarks](#benchmarks) shows                             |
| needs a real system, such as a browser or a container                                                                           | where [Where each test runs](./slow-tests.md#where-each-test-runs) says, with the command it names                 |
| does anything else                                                                                                              | beside the module or script it tests                                                                               |

## End-to-end suites

An `e2e/` test runs a program from the test's own package as a separate process, and drives the
program from outside. Start each file name with a prefix from [E2e prefixes](#e2e-prefixes).

### Start the program through rig

1. Declare the program under `programs` in `rig.config.ts`, with the keys `package`, `source`,
   `build` and `artifact`.
   [Programs in e2e tests](https://github.com/zgeoff/tools/blob/main/docs/guides/e2e-programs.md),
   in the rig docs, explains each key.
2. In the test, call `resolveProgram(name)` from `@zgeoff/rig/e2e`, where `name` is the program's
   key under `programs`. It returns a promise of `{ command, cwd }`. Never write the command in the
   test.
3. Pass `command` and `cwd` to one helper from
   [`@zgeoff/testing`](https://github.com/zgeoff/tools/tree/main/packages/testing). Call it
   directly, or write a helper in `src/test-utils/` when several files repeat the same options:
   - `run` from `@zgeoff/testing/process`, for a program that runs to its exit. It returns the exit
     code and the output.
   - `start` from `@zgeoff/testing/process`, for a program that keeps running, such as a server. It
     picks a free port, passes the port to the program as `PORT`, and waits for its `ready` option.
     `ready: { url: '/health' }` waits until that URL on the port answers with a 2xx.
     `ready: { stdout: /^listening/u }` waits for a matching stdout line, and `ready: { check }`
     waits until `check` returns true. Without `ready`, `start` returns at once. `stop(signal)` on
     its handle signals the program's whole process group and returns the exit code.
   - `spawnCLI` from `@zgeoff/testing/cli`, for a program that a person types into. It runs the
     program in a pseudo-terminal.
4. Run the tests with `bun run test:e2e`, the script that runs `rig e2e`. When `package.json` lacks
   the script, `git add` your first `e2e/` test file, then run `bun x rig init`. It adds the script
   only once git tracks a test file for it. `rig e2e` builds each program once, and `resolveProgram`
   gives the command that runs the built file. When you run one `e2e/` file with `bun test` on your
   machine, `resolveProgram` gives the command that runs the source. In CI, `resolveProgram` throws
   when nothing built the program.

This test needs no `setupTest`, because `await using` stops the program when the test ends. After an
explicit `stop`, the disposal finds no running process and does nothing:

```ts
// packages/ledger/e2e/stop-on-signal.test.ts, in a made-up repo
import { resolveProgram } from '@zgeoff/rig/e2e';
import { start } from '@zgeoff/testing/process';

test('it exits 0 on SIGTERM', async () => {
  const program = await resolveProgram('ledger');

  await using ledger = await start(program.command, {
    cwd: program.cwd,
    ready: { url: '/health' },
  });

  expect(await ledger.stop('SIGTERM')).toBe(0);
});
```

### E2e prefixes

Start each `e2e/` file name with one of these prefixes. Test a case that no prefix covers as a unit
test of the code that the case reaches.

| Prefix     | What the test checks                                                                 |
| ---------- | ------------------------------------------------------------------------------------ |
| `start-`   | the program starts and reports ready, or refuses a bad config                        |
| `stop-`    | a signal or a shutdown command, then a clean exit                                    |
| `recover-` | the program is killed mid-work, or a service it uses fails, and the program recovers |
| `cli-`     | a command's wiring: its exit code and output                                         |
| `build-`   | the artifact itself: it runs from a clean folder, with its assets                    |
| `runtime-` | a code path `bun run test` can't load, such as React Server Components               |
| `enforce-` | a guarantee that only the real environment enforces, such as a memory limit          |
| `compat-`  | two versions meet, such as an older client and a newer server                        |
| `journey-` | one core user journey, such as signing in, on its success path                       |

- To make the program fail where a `recover-` test needs it, give the program a fault switch, such
  as an environment variable that it reads at that point in its code. Pass the switch through
  `start`'s `env` option. Test the code's other failures at that point as unit tests.
- Test each other case of a journey, such as a wrong password, as a unit test.
- Test each argument and flag of a CLI through its real parser in a unit test, and keep the code
  that builds the CLI's commands importable for it. The `cli-` tests check only each command's
  wiring.

### Files and shared hosts

Never share a `setupTest` or a cleanup between `e2e/` test files: when a file needs one, give it its
own. A file's own `setupTest` may call a shared helper from `src/test-utils/`, such as the reset
helper below. Inside an `e2e/` test, you may chain acts, and assert after each one, because each act
needs the state that the act before it left. Outside `e2e/`, a test has one act, as
[Test shape](../SKILL.md#test-shape) says.

To share a slow service, such as a VM or a database container, across the `e2e/` tests:

1. Write a module that starts the service and one that stops it, in `src/test-utils/`.
   Default-export a function from each. rig calls each function with the same `LaneContext` from
   `@zgeoff/rig`, which holds `repoRoot`, `lane`, `runID` and `environment`.
2. Return the address the tests need from the start function, such as
   `{ environment: { DATABASE_URL: url } }`. rig adds each entry of `environment` to the environment
   of the test process.
3. Find the service in the stop function from the context, such as by a container name that both
   functions build from `runID`. The stop function never gets what the start function returned.
4. In `rig.config.ts`, give the two module paths as `lanes.e2e.start` and `lanes.e2e.stop`
   ([rig](https://github.com/zgeoff/tools/tree/main/packages/rig)). Under `lanes`, `rig.config.ts`
   holds only the test commands the repo adds or changes, by their `rig` name: `e2e` is the name for
   `bun run test:e2e`. rig runs each module once each time `bun run test:e2e` runs, outside the test
   files.

Leave the `.docker` suffix off the `e2e/` test files that connect to the service. The suffix is for
a test that starts a container itself, and `bun run test:e2e` skips a file that has it.

- Never start a shared service in the `[test] preload` of `bunfig.toml`. `bun run test` loads that
  file too, and would start the service for nothing, or fail on a machine without it. Wire
  everything else a test needs in each file's own `setupTest`, as [setupTest](../SKILL.md#setuptest)
  says.
- Reset the shared service to its starting state in each file's `setupTest`, through one reset
  helper in `src/test-utils/`. When the service has no reset, make the helper rebuild its state,
  such as by recreating the database.
- Give the reset helper its own test file in `src/test-utils/`. Test that the reset reaches the
  starting state from what a test changed, from what a test left when it failed midway, and from
  what the test process left when it got a `SIGINT`.
- To get the state a `SIGINT` leaves, run a script that writes to the service with `start` from
  `@zgeoff/testing/process`. Wait until the script has written, then call `stop('SIGINT')` on its
  handle.

## Real applications and transport

Test a client that the repo ships, such as a CLI or an SDK, against the real service from the same
repo. Give each test its own data. Use a stand-in only for a system that the test can't run, such as
a remote service. A test that `bun run test` runs can't run a VM or change the kernel. An `e2e/`
test can use a VM that [Files and shared hosts](#files-and-shared-hosts) shares.

In a test that `bun run test` runs, call the service in the test's process, such as through its
request handler or an in-memory RPC link, as [the cause table](./slow-tests.md#causes-and-fixes)
says. When the client runs as a child process, start the service on a real port, so the child
reaches it, and put the test in `e2e/`. Name the test with the prefix for what it checks, such as
`cli-` for a command's wiring or `compat-` for an older client.

For a remote HTTP service, use MSW, as in [Boundaries](../SKILL.md#boundaries). Write a stand-in
server on a real socket only when MSW can't intercept the call, such as:

- a call that checks a certificate, or goes through TLS or a tunnel;
- a call on a Unix socket whose options MSW drops;
- a request from a child process, a container or a VM.

Try MSW on the call first, with the version the repo installs. In a stand-in server:

- Route each request by its method and path, as the real service does.
- Encode each response in the real service's format, such as JSON with its field names.
- Parse the server's stored state with a zod schema.
- Fail loudly on each call it doesn't expect.

## Stateful stand-ins

When the repo starts a program in another process and drives it over the program's own protocol,
such as a worker, a language server or a sandboxed guest, test the code that drives it against a
stateful stand-in of the program:

- Send and accept the real messages over the real framing.
- Keep the state the program keeps, and answer from that state.
- In a test, shape the state through the stand-in's methods, and call the driving code through its
  real functions.
- Run the real program only in the program's own suite, so the tests of the driving code start no
  process.

Write a stand-in with state, never one that each test scripts. With a scripted stand-in, each test
writes out the program's behaviour again, and the stand-in accepts a message the real program
refuses, so a bug in the driving code passes.

In this made-up example, a build server sends jobs to a worker process that keeps a cache of
checked-out repositories. When the server skips the checkout for a repository the worker evicted,
the stand-in refuses the build, as the real worker does:

```ts
test('it checks a repository out again after the worker evicts it', async () => {
  const ctx = await setupTest(); // the build server, wired to the stand-in worker

  await ctx.server.build({ repo: 'acme/api', ref: 'main' });

  ctx.worker.evict('acme/api');

  await ctx.server.build({ repo: 'acme/api', ref: 'main' });

  expect(ctx.worker.received.map((message) => message.type)).toStrictEqual([
    'checkout',
    'build',
    'checkout',
    'build',
  ]);
});
```

A scripted worker answers the second `build` with whatever its script holds, so a server that never
sends the second `checkout` still passes.

Keep the stand-in in `src/test-utils/`, the test helper folder that
[Where a test lives](../SKILL.md#where-a-test-lives) describes, as `start-stub-<program>.ts`, with
its own tests. In each of those tests, check one behaviour the stand-in copies from the real
program, such as the refusal for an evicted repository.

When the stand-in makes up a value, such as a fake hash or a fake signature, assert only its
properties: its shape, that the same input gives the same output, and that different inputs give
different outputs.

## Browser suites

Name a browser suite `<module>.browser.test.ts`, beside the module it tests, and run it with
`bun run test:browser`, which
[`@zgeoff/rig`](https://github.com/zgeoff/tools/tree/main/packages/rig) runs. rig's preload for
these files starts Chrome. In `setupTest`, open a view on that Chrome with
`new Bun.WebView({ backend: 'chrome' })`, and close the view in `onTestFinished`. To set up
`bun run test:browser`, its build and its memory cap, follow
[rig's browser guide](https://github.com/zgeoff/tools/blob/main/docs/guides/browser-lane.md).

Use Playwright only for an e2e test that needs Firefox, WebKit on Linux or a live system, such as a
deployed site. `Bun.WebView` has no Firefox and runs WebKit only on macOS. Run a Playwright test
with Playwright's own runner, never under `bun test`.

### Page code

Send page code longer than one line through `runInPage(view, fn, arg, schema)` from `@zgeoff/rig`,
never as a string passed to `view.evaluate`. Write the page code as a real function in the test, so
the type checker and the linter check it.

- Pass the function everything it reads in `arg`. The function runs in the page and sees only its
  argument and the page's globals, so a test variable in its body passes the type check and throws a
  `ReferenceError` in the page.
- Parse the result with a zod schema, with no cast. The parse also fails a result that JSON can't
  carry, such as a `Blob`, which arrives as `{}`.
- Leave a one-line `view.evaluate` call as it is.

### Time and helpers

- Keep every browser test under the 10 s timeout of `bun run test:browser`. Never give a browser
  test the disable comment from [A test over its limit](./slow-tests.md#a-test-over-its-limit).
- When a browser test runs longer, find its cause in
  [the cause table](./slow-tests.md#causes-and-fixes). Move a build out of the test and into the
  `build:browser` script, which rig runs once each time `bun run test:browser` runs. Replace a fixed
  wait with a wait for the element or the event. Split a browser test of a whole user flow into a
  test per component or page. A `journey-` test in `e2e/` keeps its whole flow.
- Test navigation across the web app's routes in a browser suite.
- Give each browser helper that the repo writes, such as one that opens a view, its own test file.
- Keep every test that needs no page out of a browser suite, so `bun run test` runs it fast.

## Native timers and scenario delays

Find which kind of timer your test waits on, then follow the rules under its heading.

### A timer the runtime or the kernel runs

- Set the timer, such as a server's idle timeout, through its real setting, to the shortest value
  that still behaves like the real one. When the runtime reads the setting only at start-up, start a
  child process for this test alone, with the setting.
- Check that the timer fires. A keep-alive, such as a ping, resets the timer, so a test that only
  sets a short value never sees it fire. Add a second test that stops the keep-alive and checks that
  the timeout then ends the operation.
- Test the default value in its own test. Wait out the real default only when the runtime has no
  shorter setting that behaves the same. Wait for the timeout's event with `waitFor` from
  `@zgeoff/testing/helpers`, and keep the test in `bun run test` with the disable comment from
  [A test over its limit](./slow-tests.md#a-test-over-its-limit).

### A timer inside a library

- Pass the shortest duration the library accepts, and wait on an event you can see.
- When the timer ends a silent peer, such as a heartbeat timeout, add a second test that shows the
  same duration doesn't fire while the peer still answers.
- Use fake timers only when the library's timers don't interleave with real I/O.

### A deadline in a process the test spawns

When the repo's code sets a deadline in a process the test spawns, such as how long a crash-test
harness waits for writes to settle, take its length from an option of that code or from a constant
the code exports. Never copy the number into the test. Wait on a condition that the test checks or
the process reports.

### A deadline in the test's own process

When the repo's code sets a deadline in the test's own process, including with a `setTimeout`, pass
the time in as an argument or an injected clock, in the order
[Time and waiting](../SKILL.md#time-and-waiting) gives.

### Delays in a scenario

You may use a real delay to set the rate of an end-to-end workload or the offset of a seeded fault.
Name the rate or the fault in a comment. When a random seed picks the fault's offset, keep that seed
in the code. To claim that a fault lands in the middle of an operation, assert the order of the
operation's start, the fault and the operation's end, from events the code emits. Check both the
fault and the recovery. Use a fixed wait only when the elapsed time is part of the contract.

## Property tests

You may assert in a loop in two cases:

- over a list the module exports, such as a table of commands, to check that each entry is complete;
- over the cases that fast-check generates, awaiting each one.

Use fast-check when the combinations of generated inputs or of operation sequences matter. For a
fixed list of cases, use `test.each`. Await an async `fc.assert`, so a failed property fails the
test.

Inside the property runner and the function that applies each generated operation, you may loop over
operations, branch on the expected outcome, and check invariants after each operation. Every other
test still follows the testing skill's rules on loops, branches and one act per test.

- Check the transitions that matter, as well as the final state. Let an unexpected error fail the
  property. Never catch it in a branch for an expected outcome.
- Derive invariants from an independent contract or a simpler model, never from a copy of the
  production algorithm.
- Start each generated case from clean state, and release its resources before the next case. Get
  them from a tested helper that cleans up inside the case, on success and on failure.
  `onTestFinished` runs once, after the whole Bun test, so it can't keep the generated cases apart.
- When a property fails, fast-check prints the seed, the path and the shrunk counterexample. Replay
  the failure by passing that `seed` and `path` to `fc.assert`. When the counterexample shows
  behaviour the suite must keep, add a fixed test with it.
- Never cut generated cases to make a suite faster. Fix the cause from
  [the cause table](./slow-tests.md#causes-and-fixes).

## Evaluation suites

Give each evaluation its own folder, `evals/<name>/`, in the package whose code it scores, with
these files:

| File                 | What it holds or does                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `corpus.json`        | the committed cases or recorded traffic                                                  |
| `report.json`        | the committed results of the last scoring run                                            |
| `<name>.test.ts`     | the test, which `bun run test` runs, under its 5 s timeout                               |
| `run-<name>-eval.ts` | scores the code, such as a model's answers, and writes `report.json`; `rig eval` runs it |

When the scoring runs offline, make the test replay the corpus through the production path and
compare the result with `report.json`. When the scoring needs a live model, the test can't replay
it: make the test build the parts of the report that the code decides, and compare those. Such parts
include the prompt that the code sends for each case, and the score that it gives each recorded
answer. A test that only reads `report.json` passes after the code changes and the report goes
stale.

- Read the committed corpus or report through one tested loader. Never copy its cases into the test
  as literals.
- Keep an evaluation's helpers in `src/test-utils/`. Put measurement code that several packages use,
  such as a confidence interval or a report writer, in a package of its own that exports it.
- Use a stand-in only for what a recording can't reproduce, such as the disk or the API of a code
  host like GitHub, and inject it into the production path.
- Keep a test that calls a live API, such as a test that pins how a model SDK behaves, out of
  `evals/`. Name it `<module>.model-api.test.ts`, beside its module, as
  [Where each test runs](./slow-tests.md#where-each-test-runs) describes.

## Benchmarks

- Put a benchmark of one module beside it, as `src/<module>.bench.ts`.
- Put a benchmark of a running program in `bench/<name>.bench.ts` of the package that builds the
  program. Start the program with `start` from `@zgeoff/testing/process` in the benchmark's `setup`
  function, as in the example below. Keep only these entry files in `bench/`. Put their logic, with
  its tests, in `src/test-utils/`.
- Export each benchmark with `defineBench` from `@zgeoff/rig/bench`, with a `budget` for the median
  time of one `run`.
- Run benchmarks with `rig bench`, never in a test run. It builds each program once, as `rig e2e`
  does, and fails when the median passes the budget.
- To give the benchmarks the services that a test command shares, set `bench.lane` in
  `rig.config.ts` to that command's `rig` name, such as `'e2e'` for `bun run test:e2e`. `rig bench`
  then runs that command's `start` module before the first benchmark, and its `stop` module after
  the last.
- Return the handle from `setup`. `rig bench` disposes of it after the runs, which stops the
  program.

```ts
// packages/ledger/bench/import-statement.bench.ts, in a made-up repo
import { defineBench } from '@zgeoff/rig/bench';
import { resolveProgram } from '@zgeoff/rig/e2e';
import { start } from '@zgeoff/testing/process';
import { importStatement } from '../src/test-utils/import-statement.ts';

export default defineBench({
  name: 'import one statement',
  budget: '800ms',
  setup: async () => {
    const program = await resolveProgram('ledger');

    return start(program.command, { cwd: program.cwd, ready: { url: '/health' } });
  },
  run: (ledger) => importStatement(ledger, 'statement.csv'),
});
```

## Golden tests

Use a snapshot only for machine output that no person writes by hand, such as generated SQL. Make it
an inline snapshot, and never snapshot a component. Check a hand-written value, such as a spec test
vector, with an explicit matcher.

For code that generates machine output from its input, such as SQL or an OpenAPI document, write a
golden test and a determinism test when the output depends only on the input. Put both beside the
code's module:

- In each golden test, write one input by hand as a literal, and pin the full output in an inline
  snapshot. Never build the input with a factory call. A change to the factory would change the
  input, and updating the snapshot would hide that.
- When the output is a file the repo commits, such as an OpenAPI document, compare the output with
  that file in place of an inline snapshot.
- In the determinism test, assert that the same input gives equal outputs:
  `expect(run(input)).toStrictEqual(run(input))`.

## Program-fixed paths and global resources

When a kernel or a program fixes a path, such as a certificate trust directory, procfs or a VM mount
point, name the program or the spec that fixes it in a comment.

- Run the program so that its fixed path lands inside something the test created, such as a temp
  directory, a mount namespace or a container. Check that the path is inside it before you write
  there. When you can't check that, use a VM or a container that only this run uses.
- Create each test's own files and records in that test, and clean them up.
- Give a resource that the whole machine shares a name that sets this run apart, the way `mkdtemp`
  does.
- Before you overwrite, truncate, mount or delete a resource, check that this run created it, such
  as from a list the run keeps of what it made. Never trust a generated name alone.
- Register cleanup right after you acquire a resource, and release only what this run acquired. Make
  the cleanup safe to run after a partial failure, an interrupt, or a shutdown that already released
  the resource.

## Rust tests that need a real system

Run a Rust test that needs a real system through its own cargo-nextest profile, with the timeouts in
[Where each test runs](./slow-tests.md#where-each-test-runs). Put the test in a top-level module
named for the profile, such as `mod e2e` or `mod host`, in its crate or test binary. nextest names
each test by its module path, so a test in `mod e2e` starts with `e2e::`. Select each profile's
tests by that prefix in its `default-filter`, as a folder or a file suffix selects them for Bun.
Define the profiles in `nextest.toml`, in the repo's `.config/` folder, as in this made-up example:

```toml
[profile.default]
slow-timeout = { period = "5s", terminate-after = 1 }
default-filter = "not (test(/^e2e::/) | test(/^host::/))"

[profile.e2e]
default-filter = "test(/^e2e::/)"
slow-timeout = { period = "15s", terminate-after = 1 }

# 48 s on CI, OPS-212
[[profile.e2e.overrides]]
filter = "test(=e2e::restores_a_volume_from_its_oldest_snapshot)"
slow-timeout = { period = "60s", terminate-after = 1 }

# 22 s on CI; floor: one VM boot plus a kernel module load
[[profile.e2e.overrides]]
filter = "test(=e2e::loads_the_driver_after_a_cold_boot)"
slow-timeout = { period = "30s", terminate-after = 1 }
```

- Run the tests that need no real system with `cargo nextest run`, which uses the default profile.
  Its `slow-timeout` ends a test at 5 s, and its `default-filter` leaves out every other profile's
  prefix.
- Give each other profile its prefix in `default-filter` and its timeout in `slow-timeout`. A
  profile takes every setting it doesn't set from `default`. Run it with
  `cargo nextest run --profile <profile>`, such as `cargo nextest run --profile e2e`.
- Give a test over its timeout an override in its profile, with a comment that gives the time it
  takes on CI and a ticket, or `floor:` and the evidence that the time can't drop, as
  [A test over its limit](./slow-tests.md#a-test-over-its-limit) says.
