# Observability testing

Test metrics, spans, error reports and log lines like any other output, because dashboards, alerts
and the person reading an incident rely on them. Run the real SDK, and read what it records back
through an in-memory exporter or a server on the loopback interface. Never spy on the SDK or the
logger. With a spy, you see only that your code called a function, and you miss what the SDK
filters, shapes and sends.

- [Metrics](#metrics)
- [Spans](#spans)
- [Error reports](#error-reports)
- [Log lines](#log-lines)
- [Exporters](#exporters)

## Metrics

In instrumented code, call `metrics.getMeter(…)` each time you record, never at module load. The
OpenTelemetry API hands out a no-op meter while no meter provider is registered, and a meter created
at module load keeps it for the whole run. When code gets its meter on each call, a test can
register a meter provider and clear it when the test ends.

Give each counter two tests. Name the first `it records <metric> per <attribute>`, and in it:

1. Register an in-memory meter provider through the repo's helper for it in `src/test-utils/`.
2. Record the counter two or three times, with distinct attributes.
3. Read the points back through the helper, and assert each point's attributes and value.

Name the second `it stays inert without a registered meter provider`. In it, call your function that
records the counter with no provider registered, and assert that it doesn't throw.

When the repo has no helper, write one in `src/test-utils/` that a test calls and that does this:

- builds a `MeterProvider` from `@opentelemetry/sdk-metrics`, with a `PeriodicExportingMetricReader`
  over an `InMemoryMetricExporter(AggregationTemporality.CUMULATIVE)`, and sets it with
  `metrics.setGlobalMeterProvider`;
- reads points by calling `provider.forceFlush()`, then `exporter.getMetrics()`;
- in `onTestFinished`, calls `metrics.disable()` to clear the global, then `provider.shutdown()`.

## Spans

Set the tracer provider, the context manager and the propagator once, in the
[test preload](./cleanup.md#the-test-preload), and never in a test. Each one is a global that stays
for every later test. Code that gets its tracer at module load binds that tracer to the first
provider it records a span with, and `trace.disable()` leaves the binding in place. A test can't
change when library code gets its tracer, so keep one tracer provider for the whole run.

In the test preload, build a `TracerProvider` with an `InMemorySpanExporter` behind a
`SimpleSpanProcessor`. All three come from `@opentelemetry/sdk-trace`, the trace SDK of
OpenTelemetry JS 3. Set the context manager and the propagator in the test preload too. The provider
sets neither, and without a context manager a span started inside another span gets no parent.

Clear the exporter after each test. In a test, import `spanExporter` from the test preload, and read
the finished spans from it.

```ts
// register-tracing.ts, the test preload
import { afterEach } from 'bun:test';
import { context, propagation, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from '@opentelemetry/sdk-trace';

export const spanExporter = new InMemorySpanExporter();

context.setGlobalContextManager(new AsyncLocalStorageContextManager());
propagation.setGlobalPropagator(new W3CTraceContextPropagator());
trace.setGlobalTracerProvider(
  new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter: spanExporter })] }),
);

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
each event asynchronously, so wait for it with `waitFor` before you assert, as
[Time and waiting](../SKILL.md#time-and-waiting) says.

## Log lines

Give the logger an injected destination stream, `{ write: (line) => lines.push(line) }`. When the
logger takes no destination, make its factory take one. Parse each captured line with `JSON.parse`
and assert it with `toMatchObject`. Pair each such test with one that logs below the configured
level and asserts `toBeEmpty()` on the captured lines.

## Exporters

Test the code that ships telemetry to a collector over OTLP, such as a function that starts trace
export, against a server on the loopback interface. The tracer provider from the test preload stays
the global one, because the API returns `false` from each later `trace.setGlobalTracerProvider`
call. A span from the global tracer goes to the in-memory exporter, never to the OTLP exporter. Have
the code under test return the provider it builds, and start the test's span from that provider.

1. Start `Bun.serve({ port: 0 })` with a `fetch` handler that pushes each request to an array and
   returns a `200`. Stop the server in `onTestFinished`.
2. Set `OTEL_EXPORTER_OTLP_ENDPOINT` to the server's URL with `updateEnv`, as
   [Cleanup](../SKILL.md#cleanup) says, before you call the code under test.
3. Call the code under test. On the provider it returns, start a span with
   `getTracer(…).startSpan(…)`, and end it. The exporter sends only spans that have ended.
4. Call `shutdown()` on that provider. It sends the spans the provider holds, then stops the
   provider.
5. Assert the request path, such as `/v1/traces` for spans, the headers your config sets, and a body
   that isn't empty.
