---
name: function-naming
description:
  "The verb table for function names: which verb starts a name for each kind of job, what each verb
  guarantees about I/O and a miss, and the verbs never to use. Load it before you name or rename a
  function in a repo that has no code-style skill of its own."
metadata:
  kind: rule-set
---

# Function naming

A function's first word tells the reader whether it does I/O and whether it can miss, before they
open it. This table is the one in the `code-style` skill of the zgeoff repos. In a repo that has
that skill, load it and follow it.


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
| prop or parameter that takes an event callback                                                            | `on`                         | follows the framework's callback convention                                    |
| function passed to an `on` prop, or a function that handles a framework lifecycle event such as a request | `handle`                     | follows the framework's callback convention                                    |
| a test file's per-test fixture                                                                            | `setupTest`                  | one per test file, called by each test                                         |
| stored state put in place for a test, through the production module when the module can make that state   | `seed`                       | may do I/O; test code only                                                     |

- Keep a pure function pure all the way down: a `build` that calls a `read` does I/O. No lint rule
  checks the verbs in a repo without a code-style skill, so check each one by hand.
- Start a boolean function with `is`, `has`, `can` or `should` even when another verb reads well.
  Three kinds of boolean function keep their own verb:
  - a yes/no answer that needs I/O, which starts with `probe`;
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
