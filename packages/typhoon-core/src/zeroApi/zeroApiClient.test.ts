import {
  createBuilder,
  createSchema,
  number,
  string,
  table,
  type MutateRequest,
  type QueryOrQueryRequest,
  type Schema as ZeroSchema,
} from "@rocicorp/zero";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Schema } from "effect";
import * as ZeroService from "../services/zeroService";
import * as ZeroApi from "./zeroApi";
import * as ZeroApiClient from "./zeroApiClient";
import * as ZeroApiEndpoint from "./zeroApiEndpoint";
import * as ZeroApiGroup from "./zeroApiGroup";

const zeroSchema = createSchema({
  tables: [
    table("item")
      .columns({
        id: string(),
        count: number(),
      })
      .primaryKey("id"),
  ],
});

const builder = createBuilder(zeroSchema);

const getItem = ZeroApiEndpoint.query("getItem", {
  request: Schema.Struct({ id: Schema.String }),
  success: Schema.Struct({ id: Schema.String, count: Schema.Number }),
  query: ({ args }) => builder.item.where("id", "=", args.id).one(),
});

const getByCount = ZeroApiEndpoint.query("getByCount", {
  request: Schema.Struct({ count: Schema.NumberFromString }),
  success: Schema.Array(Schema.Struct({ id: Schema.String, count: Schema.Number })),
  query: ({ args }) => builder.item.where("count", "=", args.count),
});

const setCount = ZeroApiEndpoint.mutator("setCount", {
  request: Schema.Struct({ id: Schema.String, count: Schema.Number }),
  mutator: async ({ args, tx }) => {
    await tx.mutate.item.update(args);
  },
});

const ItemsGroup = ZeroApiGroup.make("items").add(getItem, getByCount, setCount);
const TestApi = ZeroApi.make("test").add(ItemsGroup);

type FakeZeroService = ZeroService.ZeroService<ZeroSchema, any, any>;

const provideFakeZero = <A, E>(
  effect: Effect.Effect<A, E, ZeroService.ZeroServiceTag<ZeroSchema, any, any>>,
  service: FakeZeroService,
) =>
  Effect.provideService(
    effect,
    ZeroService.ZeroService<ZeroSchema, any, any>(),
    service,
  ) as Effect.Effect<A, E, never>;

const makeFakeZeroService = (options: Partial<FakeZeroService>): FakeZeroService =>
  ({
    zero: {} as never,
    run: () => Effect.succeed(undefined),
    mutate: () =>
      Effect.succeed({
        client: () => Effect.void,
        server: () => Effect.void,
      }),
    ...options,
  }) as FakeZeroService;

describe("ZeroApiClient", () => {
  it.effect(
    "decodes query success values",
    Effect.fnUntraced(function* () {
      const client = yield* provideFakeZero(
        ZeroApiClient.make(TestApi),
        makeFakeZeroService({
          run: (() => Effect.succeed({ id: "item-1", count: 1 })) as FakeZeroService["run"],
        }),
      );

      const result = yield* client.items.getItem({ id: "item-1" });

      expect(result).toEqual({ id: "item-1", count: 1 });
    }),
  );

  it.effect(
    "fails query methods on invalid success values",
    Effect.fnUntraced(function* () {
      const client = yield* provideFakeZero(
        ZeroApiClient.make(TestApi),
        makeFakeZeroService({
          run: (() => Effect.succeed({ id: "item-1", count: "bad" })) as FakeZeroService["run"],
        }),
      );

      const exit = yield* Effect.exit(client.items.getItem({ id: "item-1" }));

      expect(Exit.isFailure(exit)).toBe(true);
    }),
  );

  it.effect(
    "encodes query request values before building Zero requests",
    Effect.fnUntraced(function* () {
      let capturedArgs: unknown;
      const client = yield* provideFakeZero(
        ZeroApiClient.make(TestApi),
        makeFakeZeroService({
          run: ((request: QueryOrQueryRequest<any, any, any, any, any, any>) => {
            capturedArgs = "args" in request ? request.args : undefined;
            return Effect.succeed([{ id: "item-1", count: 3 }]);
          }) as FakeZeroService["run"],
        }),
      );

      const result = yield* client.items.getByCount({ count: 3 });

      expect(capturedArgs).toEqual({ count: "3" });
      expect(result).toEqual([{ id: "item-1", count: 3 }]);
    }),
  );

  it.effect(
    "runs the server mutation phase by default",
    Effect.fnUntraced(function* () {
      let clientRuns = 0;
      let serverRuns = 0;
      let capturedArgs: unknown;
      const client = yield* provideFakeZero(
        ZeroApiClient.make(TestApi),
        makeFakeZeroService({
          mutate: (request: MutateRequest<any, any, any, any>) => {
            capturedArgs = request.args;
            return Effect.succeed({
              client: () =>
                Effect.sync(() => {
                  clientRuns++;
                }),
              server: () =>
                Effect.sync(() => {
                  serverRuns++;
                }),
            });
          },
        }),
      );

      yield* client.items.setCount({ id: "item-1", count: 2 });

      expect(capturedArgs).toEqual({ id: "item-1", count: 2 });
      expect(clientRuns).toBe(0);
      expect(serverRuns).toBe(1);
    }),
  );

  it.effect(
    "exposes explicit mutation phases through mutate",
    Effect.fnUntraced(function* () {
      let clientRuns = 0;
      let serverRuns = 0;
      const client = yield* provideFakeZero(
        ZeroApiClient.make(TestApi),
        makeFakeZeroService({
          mutate: (() =>
            Effect.succeed({
              client: () =>
                Effect.sync(() => {
                  clientRuns++;
                }),
              server: () =>
                Effect.sync(() => {
                  serverRuns++;
                }),
            })) as FakeZeroService["mutate"],
        }),
      );

      const mutation = yield* client.items.setCount.mutate({ id: "item-1", count: 2 });
      yield* mutation.client();
      yield* mutation.server();

      expect(clientRuns).toBe(1);
      expect(serverRuns).toBe(1);
    }),
  );

  it.effect(
    "keeps mixed query and mutator endpoints under one group",
    Effect.fnUntraced(function* () {
      const client = yield* provideFakeZero(ZeroApiClient.make(TestApi), makeFakeZeroService({}));

      expect(client.items.getItem).toBeTypeOf("function");
      expect(client.items.getByCount).toBeTypeOf("function");
      expect(client.items.setCount).toBeTypeOf("function");
      expect(client.items.setCount.mutate).toBeTypeOf("function");
    }),
  );
});
