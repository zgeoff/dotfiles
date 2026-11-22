# HTTP mocking

Test a package that calls a remote service over HTTP or RPC by running its real client against MSW
handlers. The handlers answer from `@msw/data` collections that hold the service's state. Seed that
state in the test, and let the client's own requests, serialisation, retries and error handling run.
Add a per-test handler only in the cases that [Per-test handlers](#per-test-handlers) lists.

Never use MSW's `setupServer` under Bun. It intercepts at Node's sockets, which Bun's native `fetch`
never opens, so its handlers miss every request
([mswjs/msw#2811](https://github.com/mswjs/msw/issues/2811)).

This file covers a client inside the package under test. See
[Real applications and transport](./system-tests.md#real-applications-and-transport) for:

- a whole program, such as a CLI or a server, tested against an application in the same repo;
- a call MSW can't reach, such as one from a child process.

Contents:

- [The test network](#the-test-network)
- [Stateful handlers](#stateful-handlers)
- [Per-test handlers](#per-test-handlers)
- [A mock API shared across packages](#a-mock-api-shared-across-packages)
- [RPC contracts](#rpc-contracts)
- [Queues and other stateful services](#queues-and-other-stateful-services)
- [Auth tokens](#auth-tokens)

## The test network

Mock `fetch` with `createTestNetwork` from `@zgeoff/testing/fetch`, never with a hand-written MSW
server. It builds the test process's one MSW network and patches the global `fetch`. Its hooks turn
the network on before the tests, reset it after each test, and turn it off at the end.

1. Create a `network.ts` file in a `mocks/` folder.
2. In it, call `createTestNetwork`, and export what it returns as `network`. In its `handlers`
   option, spread the default handlers of every package whose tests run in the process, such as
   `billingHandlers`.
3. List the file under `[test] preload` in `bunfig.toml`, beside the
   [test preload](./cleanup.md#the-test-preload), so the network covers every test file.
4. In a test, add a handler with `network.use(...)`. The reset after the test removes it and keeps
   the default handlers.

Expect a test to fail after it ends when it sends a request that no handler matches. The failure
lists each such request's URL.

```ts
import { createTestNetwork } from '@zgeoff/testing/fetch';
import { billingHandlers } from '../billing/handlers.ts';
import { searchHandlers } from '../search/handlers.ts';

export const network = createTestNetwork({
  handlers: [...billingHandlers, ...searchHandlers],
});
```

Never create a second network. `createTestNetwork` throws when the process has one already. Two
networks would patch the same `fetch`.

When a suite starts its own HTTP server on the loopback interface and sends real requests to it, the
network lets calls to `127.0.0.1`, `[::1]` and `localhost` through to Bun's own `fetch`. To use
another list, pass `passthroughHosts`, which replaces that list:

```ts
export const network = createTestNetwork({
  handlers: [...billingHandlers],
  // the e2e suites call a stub server on this host
  passthroughHosts: ['127.0.0.1', 'localhost', 'stub.internal.test'],
});
```

## Stateful handlers

Write the default handlers as a small version of the remote service over `@msw/data` collections:
read and write records, validate input, and return the real response shape. In a test, seed the
collections and call the client.

- Return the service's not-found response for a missing record, and its permission error, such as a
  403 with the service's error body, for a caller without access. Read the caller from the request's
  token, as [Auth tokens](#auth-tokens) says. Seed the collections to reach those outcomes, and
  never add a per-test handler for them.
- Shape each collection with a zod schema (`new Collection({ schema })`). Give every field a
  `.default()`, nested fields included, and use `@faker-js/faker` where the value is arbitrary.
  Leave the default off a discriminator. A discriminator is a field whose value tells one kind of
  record from another, such as `type`. Never restate a default in a `.create()` call.
- Never use `factory()`. Version 1 of `@msw/data` replaced it with `Collection`.
- Type each handler's response with the type the client reads, such as a type generated from the
  service's OpenAPI document, or the contract's output type for an oRPC service. The typecheck then
  fails on the mock when the real API changes.
- Register a literal route, such as `/notes/archived`, before a parameterised sibling, such as
  `/notes/:noteID`. MSW matches handlers in registration order, so the sibling would match first.
  Say in a comment above the handler array that the order is deliberate.

Keep records and their relationships in collections, and write to the collections from the handlers.
Use something else only in these cases:

- For a small lookup, such as an HTTP status for each health-check URL, you may use a `Map` that the
  test preload clears.
- For a side effect with no record behind it, such as a sent email, export an array, such as
  `sentEmails`, from the handler module, and clear it in the test preload.

From the module that holds the collections, export a `reset()` function that clears every
collection, and call it in the test preload's `afterEach`. In `reset()`, clear a collection whose
records reference another collection before the one it references, so no record points at a record
already cleared. Say in a comment that the order is deliberate.

From each handler module, export the base URL constant that its routes start with, such as
`NOTES_API_URL`, so a per-test handler can build the same route.

For a side effect, export each of these on its own, so a test can read the array or wrap the
resolver:

- the array;
- the resolver function that builds the response.

Never call `mock()` in a handler module. A dev server or a story can load the module too, in a
runtime that can't import `bun:test`.

## Per-test handlers

Add a handler with `network.use(...)` in a test only for one of these:

- an outcome the collections can't reach, such as a 503, a transport failure or a malformed payload;
- a sequence, such as a 503 and then a success;
- input you capture: create a `mock()` in the test, call it from a handler you write in the test
  file, and assert it with the mock matchers.

For a sequence, import `makeAnswerQueue` from `@zgeoff/testing/mocks`, and build
`const answer = makeAnswerQueue([unavailable, ok])` from `HttpResponse` values. Return `answer()`
from the handler. `answer()` throws on a request past the last answer, as
[Stand-ins](./boundaries.md#stand-ins) says.

Keep logic out of a per-test handler. Return a fixed response, or one looked up by one request
parameter. Put any other response that depends on the request in the default handlers, and never
re-implement the service's success path in a test. When you capture input in a handler, you may
still return the fixed success response the client needs:

```ts
const received = mock<(input: unknown) => void>();

network.use(
  http.post(`${NOTES_API_URL}/notes/:noteID/share`, async ({ request }) => {
    received(await request.json());

    return HttpResponse.json({ shared: true });
  }),
);

await shareNote(client, { noteID: 'note_1', email: 'sam@example.test' });

expect(received).toHaveBeenCalledExactlyOnceWith({ email: 'sam@example.test' });
```

## A mock API shared across packages

When several packages in one repo call the same service, put its collections and its handlers in one
workspace package. Give that package no test-runner dependency, so a dev server or a story can load
it too. Add its handler array to the one network of each test process that uses it, and call its
`reset()` from that process's test preload.

## RPC contracts

For an oRPC contract module, write these tests:

1. For each procedure, list in the test the error codes you expect, and assert with
   `toContainAllKeys` that the procedure's error map holds them.
2. For each error code that the contract defines, write the HTTP status you expect in the test, and
   assert that `fallbackORPCErrorStatus(code, entry.status)` from `@orpc/client` returns it. The
   function gives oRPC's default status for a code whose entry in the error map sets none.
3. When the repo commits, serves or publishes an OpenAPI document built from the contract, add a
   test that builds it with `OpenAPIGenerator` from `@orpc/openapi`, with the same
   `schemaConverters` the repo uses. When the repo commits the document, compare the result with the
   committed file, as in the [testing skill's assertions](../SKILL.md#assertions). Otherwise, assert
   that generation resolves.

## Queues and other stateful services

Put a queue, a pub/sub topic or a job service behind a thin wrapper of your own, and inject the
wrapper into the code.

In a test, build the real wrapper, and pass it an in-memory stand-in for the vendor's client. When
the service has an emulator that behaves like the real one, point the wrapper at the emulator in
place of the stand-in. The code that decides what to enqueue, and when, then runs for real. Keep the
messages in the stand-in, where a test can read them: enqueue through the real code, then inspect,
drain or advance what the stand-in holds. Put the drain and advance logic in a helper, as
[Stand-ins](./boundaries.md#stand-ins) says. A stub that only records a call can't show what was
enqueued or what the receiver does with it. Clear the stand-in's state in the test preload.

## Auth tokens

- To test token verification, sign the tokens with a test key pair, and give the real verifier the
  test public key through its normal configuration. Let it check the signature and the claims.
- When a mock needs only the caller's identity, such as a mock backend that scopes records to a
  user, you may read the token's claims without checking the signature.
- Never add a flag that turns verification off for tests. It is a production code path that only
  tests use.
