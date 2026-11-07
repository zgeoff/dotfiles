# Matchers

Pick a matcher by the kind of value it checks. The jest-extended matchers reach Bun through the
`@zgeoff/bun-test-extended` package. When the package isn't set up yet:

- When a matcher throws `TypeError` at run time, put the package at the start of the `preload` array
  of `bunfig.toml`.
- When `tsc` reports a matcher as unknown, add the package to `compilerOptions.types` in
  `tsconfig.json`.

| Value             | Matchers                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| Array             | `toIncludeAllMembers`, `toIncludeSameMembers`, `toIncludeAllPartialMembers`, `toPartiallyContain`, `toSatisfyAll` |
| Object            | `toContainEntry`, `toContainEntries`, `toContainAllKeys`, `toBeFrozen`                                            |
| String            | `toStartWith`, `toEndWith`, `toInclude`, `toEqualCaseInsensitive`, `toEqualIgnoringWhitespace`                    |
| Number            | `toBeWithin`                                                                                                      |
| Any value         | `toBeNil`, `toBeOneOf`, `toSatisfy`, `toBeEmpty`                                                                  |
| Date              | `toBeAfter`, `toBeBefore`, `toBeBetween`, `toBeValidDate`                                                         |
| Mock              | `toHaveBeenCalledOnce`, `toHaveBeenCalledExactlyOnceWith`, `toHaveBeenCalledBefore`, `toHaveBeenCalledAfter`      |
| Error and promise | `toThrowWithMessage`, `toResolve`, `toReject`                                                                     |

- Write Bun's own `.rejects` and `.resolves` without `await`. Bun settles the promise inside the
  matcher.
- Always `await` the package's `toResolve()` and `toReject()`. Each returns a promise. When the test
  doesn't await that promise, the test ends before the check runs.
- For a field the test doesn't decide, put an asymmetric matcher in the value you pass to
  `toStrictEqual`, such as `status: expect.toBeOneOf(['open', 'held'])`.
- Pass `toPartiallyContain` an object, and `toIncludeAllPartialMembers` an array of objects. When
  you pass `expect.toStartWith('a')` in place of the object, either matcher matches any non-empty
  array. To find an element by a matcher, use `toContainEqual(expect.toStartWith('a'))`.
