# Frontend testing

Render React code with React Testing Library (RTL) on happy-dom, and drive it the way a user does:
find elements by what a user perceives, interact through `userEvent`, and assert on what the user
sees or on the store the interaction changes. Serve server data through MSW handlers, as
[HTTP mocking](./http.md) describes, never through stubbed hooks. Follow the
[testing skill](../SKILL.md) rules on setup, data and assertions throughout.

Never expect a `findBy*` to reject: it waits out its whole timeout, like a sleep. To assert that an
element stays absent, see [Queries](#queries). `bun test` can't run the React Server Components
pipeline or read a real request. For those, see
[Server functions in TanStack Start](#server-functions-in-tanstack-start).

- [Preloads](#preloads)
- [Rendering](#rendering)
- [Queries](#queries)
- [Interactions](#interactions)
- [Store state](#store-state)
- [Hooks with changing input](#hooks-with-changing-input)
- [Routing](#routing)
- [Server functions in TanStack Start](#server-functions-in-tanstack-start)

## Preloads

List the preloads of
[`@zgeoff/bun-test-react`](https://github.com/zgeoff/tools/tree/main/packages/bun-test-react) in the
`preload` array of `bunfig.toml`, in this order. Then add the repo's own test preload, which starts
MSW, after them:

```toml
[test]
preload = [
  "@zgeoff/bun-test-extended",
  "@zgeoff/bun-test-react/zustand",
  "@zgeoff/bun-test-react",
  "./test-preload.ts",
]
```

Keep the `zustand` preload before the others, because it must wrap zustand's `createStore` before
any store exists. In a repo without zustand, leave it out.

With these preloads, never unmount a tree or reset a zustand store yourself. They do both after each
test, for stores from zustand's `create` and `createStore` alike.

## Rendering

- Mount through the project's `render` and `renderHook` helpers in `src/test-utils/`, which wrap
  every provider the app needs, such as a new query client per render. When the repo has none, write
  them there. Hold the results as `rendered` and `hook`, and query through `rendered`, never through
  the global `screen`.
- When a test needs one provider with a different value, call RTL's `render` with a `wrapper` that
  holds the app's providers and that one. Still query through the returned `rendered`.
- Never take a snapshot of a component. Once someone updates the snapshot, the test passes whatever
  the component renders.
- Never write a helper function in a test file that renders the component under test, such as
  `renderNoteEditor()`. It hides setup that the reader needs in the test body.

## Queries

Query by what a user perceives, in this order: `getByRole` with a `name`, then `getByLabelText`,
then `getByText`. Use `getByTestId` last, for an element a user cannot perceive by role, label or
text.

- Use `getBy*` for an element that is there now: it throws when the element is missing. Use
  `queryBy*` with `expect(…).toBeNull()` for an element that must be absent: it returns `null`. Use
  `findBy*` to wait for an element to appear.
- After a render that suspends or fetches, make the first query `await rendered.findBy*(…)`. The
  later synchronous queries then read the settled tree.
- Use `findBy*` in place of `waitFor(() => getBy*(…))`, which does the same in more code. Keep RTL's
  `waitFor`, which wraps each check in `act()`, for a condition that is not a DOM query, such as
  store state, a mock's call count or the router's location.
- To assert that an element stays absent, first wait for the element that proves the tree settled,
  then assert that `queryBy*` returns `null`.

## Interactions

Create `const user = userEvent.setup()` once per test, and drive every interaction through it:
`user.type`, `user.click`, `user.keyboard`. `userEvent` sends the full event sequence a browser
sends, so the test catches a component that handles only part of it. Use `fireEvent` only for an
event `userEvent` cannot produce, such as a raw `input` event on a one-time-code field, and name
that event in a comment.

```tsx
test('it saves a note from the editor', async () => {
  const user = userEvent.setup();
  const rendered = render(<NoteEditor />); // the project's render helper from src/test-utils/

  await user.type(await rendered.findByLabelText('Title'), 'groceries');
  await user.click(rendered.getByRole('button', { name: 'Save' }));

  expect(await rendered.findByRole('status')).toHaveTextContent('Saved');
});
```

## Store state

- In a test of code that reads a store, such as a component or a hook, set state through the store's
  exported setters, such as `setSelectedNote(…)`, or through the real interaction that calls them.
  Start only from states the app can reach.
- In a store module's own tests, of its setters and selectors, you may set the starting state with
  the store's raw `setState`. The starting state is that unit's input.
- Never restore a store in a test. The preload resets every store.

## Hooks with changing input

Drive a hook whose input changes between renders through a closure over a local variable. Change the
variable, then call `hook.rerender()` with no arguments. The hook call then reads as the app writes
it, with plain arguments, and needs no props object for `initialProps`.

```tsx
let noteID = 'note_1';
const hook = renderHook(() => useNote(noteID));

noteID = 'note_2';
hook.rerender();
```

## Routing

Mount a component that reads or changes the route through the project's router-aware render helper
in `src/test-utils/`. It builds a router on memory history and returns it on the render result, as
`rendered.router`. When the repo has no such helper, write one there that does this.

Give the helper each destination the test expects, with a fixed text for each, such as its path. The
helper sends any other path to a catch-all route that renders the component under test again. Then a
text query after a navigation finds the old screen and passes.

```tsx
const rendered = renderWithRouter(<NoteList />, { routes: { '/notes/$noteID': <p>note page</p> } });

await user.click(rendered.getByRole('link', { name: 'groceries' }));

expect(await rendered.findByText('note page')).toBeInTheDocument();
expect(rendered.router.state.location.pathname).toBe('/notes/note_1');
```

Never stub `navigate`. Never reach the router through a component that the test renders only to call
`useRouter()`, or through a module-level variable.

## Server functions in TanStack Start

Write the logic of a server function as a named, exported function that takes the validated input,
and pass it to `createServerFn`, as in `.handler((ctx) => archiveNoteHandler(ctx.data))`. Keep it
small: read the request, such as headers or cookies, load data, and pass that data as arguments or
props to code that doesn't read the request. When code below it reads the request in a test, move
that read up into the handler.

Test the handler by calling it with its input. Under `bun test`, which runs without the Start build
plugin, a call to the `createServerFn` result passes only a `Response`, or a thrown redirect or
error, to its caller, and a plain result object arrives as `undefined`. So test each branch that
returns a plain object by calling the handler. Test only the other branches through a component.

`bun test` can't read a real request either. To test a handler that reads one, mock
`@tanstack/react-start/server` once, in a `register-<module>-mock.ts` preload whose stand-in reads
from a stub store that one exported setter changes, as [Module mocks](./boundaries.md#module-mocks)
allows.

React Server Components need a server module graph that is built with the `react-server` export
condition. `bun test` builds no such graph, so no unit test can render a Server Component. When the
app renders through Server Components, write one `e2e/` test against the built app, named with the
`runtime-` prefix, as [End-to-end suites](./system-tests.md#end-to-end-suites) says. Load a route
that the server renders, and check its text.

Also write an `e2e/` test that loads a route whose handler reads the request. Add it to the app's
`runtime-` test, or write a new `runtime-` test when the app has none. The unit tests read the
request through the stand-in above, so this test is the one place where a real request reaches the
handler.

Assert a thrown redirect on the rejection itself, with no `await`, as [Matchers](./matchers.md)
says: `expect(promise).rejects.toMatchObject({ options: { href: '/login' } })`. For the branch
without a redirect, assert the resolved value.
