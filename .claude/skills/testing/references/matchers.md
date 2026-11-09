# Matchers

Pick a matcher by the kind of value it checks. The jest-extended matchers reach Bun through the
`@zgeoff/bun-test-extended` package. When the package isn't set up yet:

- When a matcher throws `TypeError` at run time, put the package at the start of the `preload` array
  of `bunfig.toml`. A preload file listed before it that calls a matcher at load time, such as
  `expect.toBeOneOf`, throws that `TypeError`. The
  [package README](https://github.com/zgeoff/tools/tree/main/packages/bun-test-extended) gives the
  `preload` entry.
- When `tsc` reports a matcher as unknown, add the package to `compilerOptions.types` in
  `tsconfig.json`.

| Value             | Matcher                           |
| ----------------- | --------------------------------- |
| Array             | `toIncludeAllMembers`             |
| Array             | `toIncludeSameMembers`            |
| Array             | `toIncludeAllPartialMembers`      |
| Array             | `toPartiallyContain`              |
| Array             | `toSatisfyAll`                    |
| Object            | `toContainEntry`                  |
| Object            | `toContainEntries`                |
| Object            | `toContainAllKeys`                |
| Object            | `toBeFrozen`                      |
| String            | `toStartWith`                     |
| String            | `toEndWith`                       |
| String            | `toInclude`                       |
| String            | `toEqualCaseInsensitive`          |
| String            | `toEqualIgnoringWhitespace`       |
| Number            | `toBeWithin`                      |
| Any value         | `toBeNil`                         |
| Any value         | `toBeOneOf`                       |
| Any value         | `toSatisfy`                       |
| Any value         | `toBeEmpty`                       |
| Date              | `toBeAfter`                       |
| Date              | `toBeBefore`                      |
| Date              | `toBeBetween`                     |
| Date              | `toBeValidDate`                   |
| Mock              | `toHaveBeenCalledOnce`            |
| Mock              | `toHaveBeenCalledExactlyOnceWith` |
| Mock              | `toHaveBeenCalledBefore`          |
| Mock              | `toHaveBeenCalledAfter`           |
| Error and promise | `toThrowWithMessage`              |
| Error and promise | `toResolve`                       |
| Error and promise | `toReject`                        |

- Write Bun's own `.rejects` and `.resolves` without `await`. Bun settles the promise inside the
  matcher, so an `await` adds nothing.
- Always `await` the package's `toResolve()` and `toReject()`. Each returns a promise. When the test
  doesn't await that promise, the test ends before the check runs.
- When the promise waits on a Worker, use none of `.rejects`, `.resolves`, `toResolve()` and
  `toReject()`. Follow [A promise that waits on a Worker](#a-promise-that-waits-on-a-worker).
- For a field the test doesn't decide, put an asymmetric matcher in the value you pass to
  `toStrictEqual`, such as `status: expect.toBeOneOf(['open', 'held'])`.
- Pass `toPartiallyContain` an object, and `toIncludeAllPartialMembers` an array of objects. When
  you pass `expect.toStartWith('a')` in place of the object, either matcher matches any non-empty
  array. To find an element by a matcher, use `toContainEqual(expect.toStartWith('a'))`.

## A promise that waits on a Worker

Pass each promise that waits on a message from a Worker to `Promise.allSettled`, and assert on the
result. Assert a rejection's code with `toMatchObject`:

```ts
const [started] = await Promise.allSettled([startIndexer(ctx.worker)]);

expect(started).toMatchObject({ status: 'rejected', reason: { code: 'INDEX_UNREADABLE' } });
```

Assert a resolved value with `toStrictEqual`, such as
`toStrictEqual({ status: 'fulfilled', value: { entries: 3 } })`.

Once the Worker has answered one message, `.rejects`, `.resolves`, `toReject()` and `toResolve()`
can miss its next one, and the test times out, with or without `await`. Whether they miss it depends
on what else runs in the process: a second Worker made the hang go away in a probe. With a Worker
from `new Worker()`, the `bun test` process also keeps running after the timeout, so CI waits for
the job's own time limit. A test whose Worker answers nothing first can pass, then hang when a
change to `setupTest()` sends the Worker a message.

Keep `.rejects` for a promise that waits on a file read, a `fetch` or a subprocess. It settles
those.

## A value that may be missing

When you assert on a field of a value that may be missing:

- With `toBeUndefined`, `toBeFalsy`, `toBeNil` or a `.not` matcher, write `invariant(value)` first,
  then assert on `value.field`. These matchers pass on `undefined`, so `value?.field` hides a
  missing value.
- With any other matcher, assert on `value?.field`. A missing value fails that matcher.

To check that the value is absent, assert on it, with no `invariant`.
