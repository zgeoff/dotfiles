# Boundaries

Find the boundary your code talks to in this table, and give the test what its row lists. Never stub
`fetch` or an HTTP client: mock the remote server with MSW, so the code's own request code runs. The
one exception is an SDK client that makes every call through one `send(command)` method, such as an
AWS SDK v3 client. Give that client a stand-in `send`.

| Boundary                                                       | The test uses                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------------- |
| A CLI the code runs, from the repo or installed, such as `git` | The real binary, spawned                                       |
| A shell script                                                 | The real script, through Bun's `$` ([Shell](./shell.md))       |
| The filesystem                                                 | A real temp folder per test, made with `mkdtemp`               |
| A database                                                     | The real engine, isolated per test ([Database](./database.md)) |
| A remote HTTP or RPC service                                   | MSW handlers ([HTTP mocking](./http.md))                       |
| A service that runs in a container, such as Redis              | The real service in a container                                |
| An SDK client that makes every call through one `send` method  | A stand-in `send`                                              |
| A worker the repo spawns and talks to over its own messages    | A stateful stand-in ([System tests](./system-tests.md))        |

## Stand-ins

- When the code builds an SDK client or another dependency itself, change it to take the dependency
  from its caller. Then pass the stand-in in.
- Never spy on a real method to make it fail.
- Build a stand-in from data only. Use one of these:
  - a fixed answer;
  - `mock()`;
  - a no-op;
  - a map from input to answer;
  - an answer queue.
- Move any logic in a stand-in to a helper in `src/test-utils/`, with its own test.
- For a sequence of answers, call `makeAnswerQueue([first, second])` from
  [`@zgeoff/testing/helpers`](https://github.com/zgeoff/tools/tree/main/packages/testing), and pass
  the function it returns as the stand-in. Each call gives the next answer, and a call past the last
  answer throws.
- Never chain `mockReturnValueOnce` or `mockResolvedValueOnce`. A call past the last answer in the
  chain returns the default silently.
- When the code polls until a deadline, you can't know how many calls it makes. Use
  `makeRepeatingAnswerQueue` from the same package. It gives the last answer again once the answers
  run out.
- Put each stand-in in `src/test-utils/`, and name the file for what it does:
  - `start-stub-<thing>.ts` starts a process or a server that keeps running;
  - `create-stub-<thing>.ts` creates a resource on disk or in a service;
  - `run-stub-<thing>.ts` is an executable script;
  - `build-stub-<thing>.ts` returns a value, such as a stand-in `send`.
- In a stand-in's own tests, check each thing it assumes about the real program against a response
  recorded from that program.

## Containers

When a test needs a container, probe for Docker at module level, and read the value only in
`skipIf`. Search `src/test-utils/` for a probe before you write one. Bun reads `skipIf` before the
test runs, so `setupTest()` can't make the value. Say so in a comment:

```ts
// skipIf reads this before the test runs, so setupTest() can't make it.
const hasDocker = await probeDocker();
```

## Failure branches

Reach a failure branch with a real failure: an address where nothing listens, an MSW handler that
returns the error, or a conflicting row. When no real failure reaches the branch, pass the code a
`mock()` that throws.

To test how code recovers after several calls fail, turn each call's rejection into a value with
`.then(() => null, (error: unknown) => error)`. Then assert the list of errors and the final state
in the same test. When you leave a rejection as it is, the test stops at the first failed call.

## Module mocks

Say the module you test imports a `db.ts` that opens a connection as it loads. Never mock `db.ts`
for that. Export a function from `db.ts` that opens the connection, or make the module you test take
the connection from its caller.

Write a module mock only for one of these, in its own file, `register-<module>-mock.ts`, that the
test preload loads:

- an API the runtime lacks, such as WebGL, whose answers a test sets through one exported setter;
- a test wrapper that the library's own docs give, such as the zustand mock that resets each store
  after a test.
