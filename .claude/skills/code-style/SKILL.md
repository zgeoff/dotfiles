---
name: code-style
description:
  "Code style for zgeoff TypeScript repos: file layout, names, state, unions, types, structure,
  errors, comments, and the function-name verb table. Load it before you write, review or rename
  TypeScript, with the repo's project-code-style skill beside it, for its stricter rules and its
  departures."
metadata:
  kind: rule-set
---

# Code style

## Files and modules

- Give each file one main export, and name the file after it: `parse-cli-args.ts` exports
  `parseCLIArgs`. `index.ts`, `types.ts` and `constants.ts` have no main export. Name a module that
  only has a side effect for what it does: `augment-bun-test.ts`.
- Order a file as imports, the main export, then its helpers in the order it calls them. Put each
  type or constant just above its first use.
- Make objects with factory functions, and never write a class. The one exception is a custom error,
  such as `class QuotaError extends Error`.

## Names

- Write an acronym in capitals: `parseCLIArgs`, `userID`, `packageURL`. At the start of a camelCase
  name, write it in lowercase: `cliPath`, `idToken`.
- Name a value for what it holds, in full words: `session`, not `s`; `manager`, not `mgr`.
- Use a short name only from this list:
  - `x` and `y` for coordinates, `z` for zod, `$` for Bun's shell, `_` for an unused value;
  - `ctx`, `id`, `db`, `args`, `params`, `repo` and `info`.
- End a name with its unit: `timeoutMs`, never `ms` alone.

## State

- When a status is saved outside the process or sent to another process, write a transition table
  for it: its states, the moves allowed between them, and one function that checks a move. Keep all
  three in the only module that writes the status.
- Build a long-lived object whose states live only in memory, such as a reconnecting client, as an
  xstate machine.

## Waiting

- Sleep with `Bun.sleep` in Bun-only code, and with `setTimeout` from `node:timers/promises` in code
  that ships to Node.
- Wait for one event with `events.once`. When code outside the promise's executor settles the
  promise, make it with `Promise.withResolvers()`.
- Write `new Promise` by hand only when none of these fits.

## Unions

- Branch on a union with `match(value)…exhaustive()` from `ts-pattern`, never `switch`, so a new
  member fails the type check.
- End with `.otherwise()` only when the value comes from outside the program, such as a string read
  from input that no schema has parsed.

## Types

- Use a type guard, an annotation, `satisfies` or a schema parse, and never a type assertion. The
  one exception is `as const`.
- When an assertion has to stay, get the maintainer's approval in the PR, and add a lint disable
  comment that gives the reason. In review, flag every new assertion, approved or not.
- Never let `any` reach a typed value. Make it `unknown` and narrow it, or parse it. `JSON.parse`
  returns `any`.

## Structure

- Send data between processes or packages through the repo's typed interface: its RPC layer, a
  shared schema, or its CLI parser. Never match a route, parse a body or read arguments by hand.
- Split a function in two when it reads something, branches on what it read, and then writes,
  removes or runs something:
  - a pure function that takes the values read and returns what to do. Give it a verb from a no-I/O
    row of the [verb table](#function-names), such as `collect` or `pick`, so the
    `zgeoff/verb-contract` rule in `@zgeoff/oxlint-config` keeps I/O out of it;
  - a thin function that does the reads, calls the pure one, and acts on its result. Give it the I/O
    verb that fits, such as `run`, `write` or `remove`, and no decision of its own.
- Write the pure function first, from the values you will read, then the thin one around it. You
  then test each edge case with one `test.each` row of plain data. In one combined function, each
  case needs a stand-in for every read and write, so the edges go untested.
- Lock a file across processes only with `withFileLock` from `@zgeoff/std/with-file-lock`, imported
  directly in the thin function. Read, decide and write in its callback, so the lock spans all
  three. Write your own lock only for a need it can't meet, such as a lock readers share, and name
  the need in a comment.
- Reach I/O through dependencies the caller passes in. Create real clients only in the entry point.
- Never write a wrapper that only passes its arguments on.
- Never add an option, a parameter or an extension point before a caller passes it.

```ts
export function collectDueReminders(tasks: readonly Task[], now: number): Task[] {
  return tasks.filter((task) => task.dueAt < now && task.remindedAt === null);
}

export async function runReminders(dependencies: ReminderDependencies): Promise<void> {
  const tasks = await dependencies.db.readOpenTasks();

  for (const task of collectDueReminders(tasks, dependencies.clock.now())) {
    await dependencies.mail.writeReminder(task.owner, task.id);
  }
}
```

## Errors and logs

- Return an expected outcome, such as a miss or bad input from outside, as a value of the return
  type. Throw only what the caller can't plan for.
- Never check again what the value's source already guarantees, such as its type, a schema parse or
  a library's documented behaviour. An example is a `null` check on a field the schema requires.
- Call `invariant()` from `tiny-invariant` on a state that only a bug can reach.
- Log failures, state changes and slow calls. Never log each call of code that runs once per request
  or per item.

## Comments

- Write a `//` comment only to say why the obvious alternative is wrong, when the cause sits outside
  the file: a library bug, a runtime quirk, a measured number. Put it at the line, in three lines at
  most.
- Never restate what the code or a test shows.
- Never write history or project state in a comment, such as "previously", an issue number or "not
  wired yet". Put it in the commit.
- Put what callers rely on in a test name, such as `it returns null for an unknown ID`, not in a
  comment. When code in another package depends on an invariant of yours, also state it in the doc
  under `docs/` for that part of the system.
- Don't name another declaration in a comment; state the fact, so a rename can't leave it stale.

## One-off codemods

- Put a one-off codemod in the PR description, in a `<details>` block with the command that ran it,
  never in the repo.

## Function names

When a function's job has a row, start its name with that row's verb, and keep the row's guarantee.
Give any other function any verb that fits, except a banned verb from the last bullet of this
section, such as `fetch` or `process`.

| Job                                                                                                       | Verb                         | Guarantee                                                                      |
| --------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------ |
| yes/no answer                                                                                             | `is`, `has`, `can`, `should` | returns a boolean; no I/O                                                      |
| yes/no answer that needs I/O                                                                              | `probe`                      | returns a boolean; may do I/O                                                  |
| value from arguments, test data factories included                                                        | `build`                      | no I/O                                                                         |
| text or raw input → structure                                                                             | `parse`                      | no I/O                                                                         |
| value → text or markup                                                                                    | `format`, `render`           | no I/O                                                                         |
| choice among known alternatives                                                                           | `pick`                       | no I/O                                                                         |
| lookup that can miss                                                                                      | `find`                       | no I/O; can return null or undefined                                           |
| lookup that can't miss                                                                                    | `get`                        | no I/O; never returns null or undefined                                        |
| many values gathered from a traversal                                                                     | `collect`                    | no I/O                                                                         |
| cheap change of representation                                                                            | `to`                         | no I/O                                                                         |
| content in from outside the process                                                                       | `read`                       | may do I/O                                                                     |
| content out to outside the process                                                                        | `write`                      | may do I/O                                                                     |
| subprocess or task                                                                                        | `run`                        | may do I/O                                                                     |
| resource brought into existence                                                                           | `create`                     | may do I/O                                                                     |
| resource taken away                                                                                       | `remove`                     | may do I/O                                                                     |
| function that returns a function                                                                          | `make`                       | returns a function                                                             |
| higher-order wrapper                                                                                      | `with`                       | runs a callback inside a context                                               |
| React hook                                                                                                | `use`                        | follows the rules of hooks                                                     |
| event-callback prop or parameter                                                                          | `on`                         | follows the framework's callback convention                                    |
| function passed to an `on` prop, or a function that handles a framework lifecycle event such as a request | `handle`                     | follows the framework's callback convention                                    |
| a test file's per-test fixture                                                                            | `setupTest`                  | as the testing skill's [setupTest](../testing/SKILL.md#setuptest) section says |
| stored state that a test puts in place by calling the module that creates it                              | `seed`                       | may do I/O; test code only                                                     |

- Keep a pure function pure all the way down: a `build` that calls a `read` does I/O. The
  `zgeoff/verb-contract` rule in `@zgeoff/oxlint-config` checks the verbs, but it can't see I/O
  inside an npm package or behind a helper whose name hides it. Check those by hand.
- Start a boolean function with `is`, `has`, `can` or `should` even when another verb reads well.
  Two kinds of boolean function keep their own verb:
  - a function with an I/O verb that returns a success flag, such as `removeFile`;
  - a function whose name starts with `use`, `on` or `handle`.
- Never use `make`, `with`, `use`, `on` or `to` as a whole name. Follow it with a noun, such as
  `toPosixPath`.
- You may start a name with `resolve` whether or not it does I/O, such as for a pure lookup or a
  filesystem search.
- Never start a name with one of these verbs. They say nothing about I/O or a miss:
  - `process`, `manage`, `do`, `perform`, `execute` or `compute`;
  - `fetch`, `save`, `store`, `delete`, `search` or `lookup`. For a database read that can miss, use
    `read` and return `null`;
  - `handle`, outside a callback.
