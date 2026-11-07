# Go testing

Write Go tests with the standard `testing` runner. These sections of the testing skill apply to Go
tests as they stand: [Principles](../SKILL.md#principles), [Test data](../SKILL.md#test-data),
[Assertions](../SKILL.md#assertions), [Errors](../SKILL.md#errors),
[Access rules](./schemas-and-access.md#access-rules) and [Narrowing](../SKILL.md#narrowing). From
[Test shape](../SKILL.md#test-shape), keep the titles and the one act per test. This file replaces
the rest of Test shape for Go. The Bun-only parts don't apply: `setupTest`, the test preload, the
jest-extended matchers, lanes and the `bun test` flags.

The mistakes to avoid:

- Never pass mutable state from a parent test to its subtests. When one subtest changes it, the
  subtests after it break.
- Never give each case a random ID so that cases which share state stop colliding. The shared state
  stays, and a later test fails on it.
- Never retry a failed test, such as with gotestsum's `--rerun-fails`, or skip one behind a check of
  the environment. Both hide a flaky test.

- [Cases and data](#cases-and-data)
- [Assertions](#assertions)
- [Cleanup and parallel tests](#cleanup-and-parallel-tests)
- [Time](#time)
- [Real boundaries](#real-boundaries)
- [CI reports](#ci-reports)

## Cases and data

- Put tests beside their package, in `_test.go` files. Name each `Test` function for the behaviour,
  such as `TestRetryStopsAfterLastAttempt`.
- Write a fixed table of cases as named `t.Run` subtests, one per row. Name each subtest as a short
  sentence with its value, such as `"stops after 3 attempts"`. Create each row's state inside the
  row.
- Keep the inputs that make a row differ from the others in that row. You may share a definition
  that no row changes, such as a server config.
- You may write a guard such as `if got != want { t.Errorf(...) }`. It checks an outcome, so the ban
  on a branch in a test body doesn't cover it.
- Keep a helper that one package uses in that package's `_test.go` files. Put a helper that several
  packages use in a test-support package, such as `internal/testsupport`, and test it.
- Generate byte and string inputs with Go's native fuzzer, `testing.F`. Generate operation sequences
  with a property library, such as `pgregory.net/rapid`. Keep each generated case apart, and replay
  a failure, as [Property tests](./system-tests.md#property-tests) describes.

## Assertions

Use `gotest.tools/v3/assert` when the project uses it:

- Compare a value of a comparable type with `assert.Equal`, which uses `==`. Compare a whole struct
  with `assert.DeepEqual`, which uses go-cmp.
- Check each independent result in its own call. `assert.Assert` and `assert.Equal` stop the test.
  Use `assert.Check` when the checks after it should still run.
- Use `assert.NilError` for a call that must succeed, and `assert.ErrorIs` for a sentinel or a
  wrapped error.

Otherwise, use the `testing` methods with go-cmp. Call `t.Fatalf` where a failure should stop the
test, and `t.Errorf` where the checks after it should still run. Compare structs with `cmp.Diff`,
and fail when the diff isn't empty.

With either one:

- Pass a go-cmp option, such as `cmpopts.EquateEmpty()`, only when the contract treats the two
  values as equal. Never use one to hide a field the test should check.
- Use `errors.As` when the error's type and fields matter. Match exact text only when the text is
  part of the contract.
- Assert on the test goroutine. Collect each worker goroutine's result through a channel or an
  `errgroup`, and assert after they all finish. Never put the only assertion in a callback that
  might never run.

## Cleanup and parallel tests

- Register `t.Cleanup` right after each acquisition. Use `t.TempDir` for a temporary tree and
  `t.Setenv` for an environment variable.
- In cleanup, use the handles and paths you saved, and release only what you acquired. Wait for
  every background goroutine to stop.
- Call `t.Helper()` in each helper, so a failure points at the calling case.
- Pass the case's `t` into a shared helper. Call `t.Cleanup` on that `t` inside the helper, so the
  cleanup runs when the case ends.
- Call `t.Parallel` only when each case holds its own state. Never call `t.Setenv` in a parallel
  test or under a parallel parent.

## Time

Control time in this order:

1. Pass the time in as an argument when the code decides something from it, such as a retry delay.
2. When the code reads the time or starts timers inside, run the test in `synctest.Test` from
   `testing/synctest`. Inside it, a sleep moves a fake clock and waits for nothing.
3. When `synctest` can't run the code, pass in a clock interface. `synctest` moves its clock only
   when every goroutine started inside it waits on a channel, a sleep, a `sync.WaitGroup` or a
   `sync.Cond`. The clock stays put while a goroutine waits on real network or file I/O, on a mutex,
   or on a goroutine started outside `synctest.Test`.

For a timer in another program or a path the host fixes, see
[Native timers and scenario delays](./system-tests.md#native-timers-and-scenario-delays) and
[Program-fixed paths and global resources](./system-tests.md#program-fixed-paths-and-global-resources).

## Real boundaries

- Use the real thing when the behaviour depends on it: temporary files, a database per test,
  `httptest` servers, sockets and processes.
- Before the test uses one, wait for a signal that it is ready, such as a server's listening
  address. In cleanup, wait until it has stopped.
- Test real network I/O, external processes and kernel calls in `Test` functions of their own,
  outside any table of cases.
- Give a stand-in the typed request and response shapes of the real contract. Keep its state in a
  map or a database that only that test uses.

## CI reports

When you set up or change the CI job for Go tests in a project that uses gotestsum:

- Run gotestsum with the project's `go test` flags, `-race` included.
- Keep its JSON output, from `--jsonfile`, as a CI artifact.
- Print the slowest cases, with `gotestsum tool slowest`.
- Pin gotestsum with a `tool` line in `go.mod`, and each library with its `require` line.

For the APIs, see [Go testing](https://pkg.go.dev/testing),
[named subtests](https://go.dev/blog/subtests),
[testing/synctest](https://pkg.go.dev/testing/synctest),
[gotest.tools assertions](https://pkg.go.dev/gotest.tools/v3/assert) and
[gotestsum](https://github.com/gotestyourself/gotestsum).
