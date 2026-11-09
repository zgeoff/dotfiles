# Factories

Write a `buildMock<Type>` factory for each domain type that crosses a module boundary, as the
testing skill's [Test data](../SKILL.md#test-data) section says. Make the factory return the value
and do nothing else: write no database row and no file in it. For stored state, call the seeds of
the module that creates the state, as [Stored state](../SKILL.md#stored-state) says. Inside each
seed, build the input with these factories.

- [Writing a factory](#writing-a-factory)
- [A factory's own test](#a-factorys-own-test)

Watch for these mistakes:

- Never pass `undefined` as an override to leave a field out. To leave an optional field out, take
  it off the factory's result: `const { note, ...line } = buildMockOrderLine();`.
  `@zgeoff/oxlint-config` sets `ignoreRestSiblings: true` on `no-unused-vars`, so the unused `note`
  passes. `@zgeoff/tsconfig` sets `exactOptionalPropertyTypes`, so an `undefined` override is a type
  error.
- In a package with a golden test, default every field of the package's own factories to a literal
  value. A golden test pins output in an inline snapshot or a committed file. Faker's values follow
  the order of its calls in the run, so one new faker call in any test file changes them.
- Never write a factory that presets overrides, such as `buildMockPaidInvoice`. The reader can't see
  its defaults. Pass the overrides in the test instead: `buildMockInvoice({ status: 'paid' })`.
- Write a seed for each state instead, such as `seedArchivedNote` in [Seeding](./seeding.md). It
  reaches the state through the module's own functions, so it never presets a field such as
  `archivedAt` by hand.

## Writing a factory

- Keep the factory, with its own test file, in `src/test-utils/` of the package that defines the
  type. For a type from a third-party package, such as an SDK result, keep it in the package that
  wraps that package. When no package wraps it, keep it in the package whose tests use it. Another
  package imports the factory by package name, through the package's `"./test-utils/*"` export, with
  a `workspace:*` dev dependency.
- Name the file `build-mock-<type>.ts`, and export `buildMock<Type>` from it: `OrderLine` gets
  `build-mock-order-line.ts` and `buildMockOrderLine`. Use `build`, because the factory creates no
  resource.
- Take one argument of overrides. Return a complete value, with every optional field filled. Return
  the object literal itself, so the return type checks each field with no cast:

  ```ts
  export function buildMockOrderLine(overrides: Partial<OrderLine> = {}): OrderLine {
    return {
      id: faker.string.uuid(),
      orderID: faker.string.uuid(),
      status: 'open',
      quantity: faker.number.int({ min: 1, max: 9 }),
      note: faker.lorem.sentence(),
      ...overrides,
    };
  }
  ```

- Outside a package with a golden test, default a field to a `@faker-js/faker` value when no test
  depends on its value. The reader then sees that the value doesn't matter. When the package has no
  `@faker-js/faker` dev dependency, add it.
- Call `faker.seed()` with a fixed number in the [test preload](./cleanup.md#the-test-preload) of
  each package that uses faker, so a rerun of the same files gives the same values again.
- Default an enum or a discriminator to the value most tests need.
- Outside a package with a golden test, default each foreign key to a new `faker.string.uuid()`.
  Never require a parent. When a test needs a real parent, seed the parent and pass its ID.
- When the type is a class, pass the merged fields to its constructor and return the instance, so
  `toStrictEqual` against a real instance passes.
- Build a nested object with its own factory, and pass it the nested override. For a list field, the
  spread replaces the whole default list, so never write merge code for a list.

  ```ts
  type ShipmentOverrides = Partial<Omit<Shipment, 'address'>> & { address?: Partial<Address> };

  export function buildMockShipment(overrides: ShipmentOverrides = {}): Shipment {
    const { address, ...rest } = overrides;

    return {
      id: faker.string.uuid(),
      carrier: 'post',
      address: buildMockAddress(address),
      ...rest,
    };
  }
  ```

- When a domain type has one shape as a database row and another in the API, write a factory for
  each shape, named for its type, such as `buildMockOrderLineRow` and `buildMockOrderLine`.
- In a test file, call the factory in the test that uses its value, never in a shared constant or a
  hook. The reader then sees each value next to the assertion that uses it.

## A factory's own test

Put the test beside the factory, as `build-mock-<type>.test.ts`, with these 2 tests:

- `test('it builds a default order line', …)`, with the type's name in place of order line. Assert
  the whole shape with `toStrictEqual` and asymmetric matchers.
- `test('it applies overrides on top of the defaults', …)`.

Add one more test for each of these parts of the factory:

- a field that the factory works out from another field;
- a nested override that the factory passes to another factory, such as `address` in
  `buildMockShipment`.

Delete the part, and check that its test fails.

Never add a test of faker's output, or a second test of the plain merge of overrides.
