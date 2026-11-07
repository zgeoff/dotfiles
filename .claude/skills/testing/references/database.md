# Database testing

Test a package that owns tables, through its migrations or its queries, against the real engine:
Postgres for a Postgres package, SQLite for a SQLite package. Never use an engine reimplemented in
JavaScript, such as `pg-mem`. SQL errors, constraint violations, migration mistakes and
query-builder edge cases are the defects these tests catch, and a reimplementation misses them. An
in-memory SQLite database (`:memory:`) is the real engine.

Give each test a database whose rows no other test sees, and pass its connection into the code under
test. When the code opens its own connection, point that connection at the test's database, as
[Postgres isolation](#postgres-isolation) and [SQLite isolation](#sqlite-isolation) say. Follow the
testing skill's rules on [setupTest](../SKILL.md#setuptest), [Cleanup](../SKILL.md#cleanup) and
[Test data](../SKILL.md#test-data) here too.

- [Postgres isolation](#postgres-isolation)
- [SQLite isolation](#sqlite-isolation)
- [Booting a service](#booting-a-service)
- [Seeding rows](#seeding-rows)
- [Reading results back](#reading-results-back)
- [Timestamps and order](#timestamps-and-order)
- [Access rules](#access-rules)
- [Configuration stored in the database](#configuration-stored-in-the-database)
- [SQL built from identifiers](#sql-built-from-identifiers)

## Postgres isolation

In `setupTest()`, get a test database from the repo's test-database helper in `src/test-utils/`, and
pass its connection to the code under test. The helper builds the schema once per run as a template,
as [Per-run templates](./slow-tests.md#per-run-templates) describes. Never drop the helper's
databases yourself. At the start of each run, the sweep in
[Leftovers of a killed run](./cleanup.md#leftovers-of-a-killed-run) removes the ones that earlier
runs left.

Pick one isolation mode for each test file, and pass it to the helper. These modes are the helper's,
not Postgres transaction isolation levels such as `SERIALIZABLE`:

- Use `transaction` by default. Each test runs in one transaction on a copy of the template that
  belongs to its test runner worker process, and the helper rolls it back after the test.
- Use `clone` when the code does one of these. Each test then gets its own copy of the template,
  which the helper drops after the test:
  - commits;
  - opens a transaction of its own, which can't run inside the test's transaction;
  - carries on after a constraint violation it caught, since one failed statement aborts the test's
    transaction and every later query in it fails;
  - uses database-wide state, such as advisory locks, `LISTEN`/`NOTIFY` or DDL statements;
  - opens its own connection, which you point at the clone.

In a file that uses `clone`, name the code that needs it in a comment, such as
`// claimJob commits the claim before it runs the job`.

## SQLite isolation

Give each test a copy of a migrated template file, so no test spends its time on migrations.

The test-database helper migrates the template once per run. Before any test copies the template,
the helper closes its connection to the template or checkpoints the template's write-ahead log. When
you copy the main file alone, the copy misses the changes that are still in the log, migrations
included. When you write such a helper, do the same.

Choose how the test gets its copy:

- When the code opens its own connection by path, or the test depends on file behaviour, such as a
  read-only connection or write-ahead logging, copy the file into the test's `mkdtemp` tree.
- When the code takes the connection as an argument, load the template's bytes into an in-memory
  database with `Database.deserialize` from `bun:sqlite`.

Open SQLite with `synchronous = off` in the helper. Your tests never need their writes to survive a
power loss, and a sync on each commit costs time. In a test of what survives a crash, use
production's setting.

## Booting a service

Give a service one function that builds it, such as `createNotesService({ db })`, and call it from
the production entrypoint and from every test. In a test, pass in only the I/O that you may replace
under the testing skill's [Boundaries](../SKILL.md#boundaries) rules, such as the database and the
clock. Never copy the service's configuration into a test's setup. The copy drifts from production.

In `setupTest()`, get the test database and boot the service through that function. Create no data
there, as in the [testing skill](../SKILL.md#setuptest). When the service refuses to start until its
data exists, boot it in the test body, after the test creates that data.

## Seeding rows

In a test outside the module that creates a table's rows, seed those rows through that module's
seeds, never with your own insert, as in [Stored state](../SKILL.md#stored-state). In the module's
own tests, and to write a seed, follow [Seeding](./seeding.md).

## Reading results back

In a test outside the module that creates a table's rows, read a row back through that module's read
function, as in [Stored state](../SKILL.md#stored-state). In the module's own test, query its table
directly. With Kysely, read a row that must exist with `executeTakeFirstOrThrow()`, and select only
the column under test when only that column matters. Assert absence with `executeTakeFirst()` and
`toBeUndefined()`.

```ts
// archive-note.test.ts, in the module that creates notes
await archiveNote(ctx.db, note.id, ctx.clock.now());

const row = await ctx.db
  .selectFrom('notes')
  .select('archived_at')
  .where('id', '=', note.id)
  .executeTakeFirstOrThrow();

expect(row.archived_at).toBeValidDate();
```

Before you read the database after a call you expect to reject, settle the call with `.catch()`.
Until the call settles, its transaction can still be rolling back, and your read races the rollback.
Then assert the rejection with the rules in the testing skill's [Errors](../SKILL.md#errors) and in
[Matchers](./matchers.md), then read:

```ts
const request = ctx.service.archiveNote({ noteID: 'missing' });

await request.catch(() => {});

expect(request).rejects.toMatchObject({ code: 'NOT_FOUND' });

expect(await ctx.service.listNotes()).toStrictEqual([]);
```

To test how code recovers after several calls fail, such as a job that gives up after its third
failed run, make the calls one after another in one test. Turn each outcome into a value: `null`
when the call resolves, and the error when it rejects. When you leave a rejection as it is, the test
stops at the first failed call. Then read the stored state, and assert the outcomes and the state:

```ts
const runJobOnce = () =>
  ctx.service.runJob({ jobID: 'job_1' }).then(
    () => null,
    (error: unknown) => error,
  );

const outcomes = [await runJobOnce(), await runJobOnce(), await runJobOnce()];
const job = await ctx.service.readJob({ jobID: 'job_1' });

expect(outcomes).toMatchObject([
  { code: 'WRITE_FAILED' },
  { code: 'WRITE_FAILED' },
  { code: 'GAVE_UP' },
]);
expect(job.status).toBe('failed');
```

## Timestamps and order

When a test asserts an order, or a winner, among rows, pass explicit, distinct timestamps.
Timestamps that a `buildMock<Type>` factory fills from the JavaScript clock can share a millisecond.
Under `transaction` isolation, Postgres also pins `now()` to the start of the transaction, so every
timestamp the database fills in within one test is the same.

When callers of a production query ordered by a timestamp need a stable result, add a tiebreaker to
the query that gives a total order, such as `.orderBy('created_at', 'desc').orderBy('id', 'desc')`.
Give the tie its own test, with two rows that share the timestamp.

## Access rules

In an access test, seed each user or role the rule covers. In the test body, build the client each
one calls through, such as an API client signed in as that user, or the test's connection switched
to that Postgres role. Then write the tests that
[Access rules](./schemas-and-access.md#access-rules) lists.

To test as a Postgres role under `transaction` isolation, run `SET LOCAL ROLE` on the test's
connection, with one role per test. Never open a second connection as the role: it can't see the
rows the test seeded, because the test's transaction never commits them.

## Configuration stored in the database

When a service reads its configuration from a table, seed the configuration rows through the seeds
of the module that creates the table's rows, and let the real query pick the row that applies. Never
stub the configuration read. Which row wins, such as the most specific match, is the behaviour under
test.

## SQL built from identifiers

When a utility puts an identifier, such as a table or column name, into SQL, make it check the name
against the list of names the code expects. Give that check its own test, with a name outside the
list.
