# Observability testing

Test metrics, spans, error reports and log lines like any other output, because dashboards, alerts
and the person reading an incident rely on them. Run the real SDK, and read what it records back
through an in-memory reader or a server on the loopback interface. Never spy on the SDK or the
logger: a spy shows that your code called a function, and misses what the SDK filters, shapes and
sends.

Watch for globals that outlive a test. The OpenTelemetry API keeps one global meter provider and one
global tracer provider, and code that gets its meter or tracer at module load stays bound to
whatever was registered then.

## Metrics

In instrumented code, call `metrics.getMeter(…)` each time you record, never at module load. The
OpenTelemetry API hands out a no-op meter while no meter provider is registered, and a meter created
at module load keeps it for the whole run.

Give each counter two tests. In the first, `it records <metric> per <attribute>`:

1. Register an in-memory meter provider through the repo's helper for it in `src/test-utils/`.
2. Record the counter two or three times, with distinct attributes.
3. Read the points back through the helper, and assert each point's attributes and value.

In the second, `it stays inert without a registered meter provider`, call your function that records
the counter with no provider registered, and assert that it doesn't throw.

When the repo has no helper, write one in `src/test-utils/` that a test calls and that does this:

- builds a `MeterProvider` from `@opentelemetry/sdk-metrics`, with a `PeriodicExportingMetricReader`
  over an `InMemoryMetricExporter`, and sets it with `metrics.setGlobalMeterProvider`;
- reads points by calling `provider.forceFlush()`, then `exporter.getMetrics()`;
- in `onTestFinished`, calls `metrics.disable()` to clear the global, then `provider.shutdown()`.

## Spans

Register one tracer provider for the whole run, in the test preload, with an `InMemorySpanExporter`
behind a `SimpleSpanProcessor`. Never register a tracer provider in a test:

- `register()` also installs the global context manager and propagator, which stay for every later
  test.
- A tracer that code gets at module load stays bound to the first provider, and never sees one that
  a later test registers.

Clear the exporter after each test. In a test, read the finished spans from the exporter.

```ts
// register-tracing.ts, listed in the test preload
export const spanExporter = new InMemorySpanExporter();

new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(spanExporter)] }).register();

afterEach(() => {
  spanExporter.reset();
});
```

```ts
test('it records a span for each note it saves', async () => {
  const ctx = await setupTest(); // a notes store on a temp database

  await saveNote(ctx.db, { title: 'groceries' });

  expect(spanExporter.getFinishedSpans().map((span) => span.name)).toStrictEqual(['notes.save']);
});
```

## Error reports

Assert error reporting against the real Sentry SDK, from the package the app uses, such as
`@sentry/node`. In `setupTest()`, create an array for the events, and call `Sentry.init` with:

- a fake DSN in the right form, such as `https://public@example.com/1`;
- `defaultIntegrations: false`;
- a `beforeSend` that pushes each event to the array and returns `null`, so no event leaves the
  process.

Return the array from `setupTest()`. Call `Sentry.close()` in `onTestFinished`. The SDK hands over
each event asynchronously, so wait for it with the `waitFor` helper before you assert.

## Log lines

Give the logger an injected destination stream, `{ write: (line) => lines.push(line) }`. When the
logger takes no destination, make its factory take one. Parse each captured line with `JSON.parse`
and assert it with `toMatchObject`. Pair each such test with one that logs below the configured
level and asserts `toBeEmpty()` on the captured lines.

## Exporters

Test the code that ships telemetry to a collector over OTLP, such as a function that starts trace
export, against a server on the loopback interface. That code builds and registers its own provider,
so the test calls it like any other production code.

1. Start `Bun.serve({ port: 0 })` with a `fetch` handler that pushes each request to an array, and
   stop the server in `onTestFinished`.
2. Set `OTEL_EXPORTER_OTLP_ENDPOINT` to the server's URL with the env helper, before you start the
   export.
3. Run the code under test, then make the export send what it holds: call `forceFlush()` or
   `shutdown()` on the provider it built, which both flush.
4. Assert the request path, the headers your config sets, and a body that isn't empty.
