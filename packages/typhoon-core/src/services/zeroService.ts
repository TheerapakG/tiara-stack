import { Effect, Match, pipe, Schema, ServiceMap, Types } from "effect";
import type {
  Zero,
  Schema as ZeroSchema,
  CustomMutatorDefs,
  QueryOrQueryRequest,
  RunOptions,
  HumanReadable,
  MutateRequest,
  MutatorResultDetails,
  ErroredQuery,
} from "@rocicorp/zero";
import {
  MutatorResultAppError,
  MutatorResultZeroError,
  QueryResultAppError,
  QueryResultParseError,
} from "../error/zero/zeroQueryError";
import { DefaultTaggedClass } from "../schema/defaultTaggedClass";

const ZeroServiceTypeId = Symbol("ZeroServiceTypeId");
export type ZeroServiceTypeId = typeof ZeroServiceTypeId;

interface Variance<out S extends ZeroSchema, out MD extends CustomMutatorDefs | undefined, out C> {
  [ZeroServiceTypeId]: {
    _S: Types.Covariant<S>;
    _MD: Types.Covariant<MD>;
    _C: Types.Covariant<C>;
  };
}

/**
 * ZeroServiceTag provides access to a Zero instance.
 */
export interface ZeroServiceTag<
  S extends ZeroSchema,
  MD extends CustomMutatorDefs | undefined,
  C,
> extends Variance<S, MD, C> {}

/**
 * ZeroServiceTag provides access to a Zero instance.
 */
export interface ZeroService<S extends ZeroSchema, MD extends CustomMutatorDefs | undefined, C> {
  zero: Zero<S, MD, C>;
  run: <TReturn>(
    query: QueryOrQueryRequest<any, any, any, S, TReturn, C>,
    runOptions?: RunOptions,
  ) => Effect.Effect<
    HumanReadable<TReturn>,
    QueryResultAppError | QueryResultParseError | Schema.SchemaError,
    never
  >;
  mutate: (request: MutateRequest<any, S, C, any>) => Effect.Effect<
    {
      client: () => Effect.Effect<
        void | MutatorResultAppError | MutatorResultZeroError,
        Schema.SchemaError,
        never
      >;
      server: () => Effect.Effect<
        void | MutatorResultAppError | MutatorResultZeroError,
        Schema.SchemaError,
        never
      >;
    },
    never,
    never
  >;
}

const parseQueryErrorResultDetails = (error: ErroredQuery) =>
  pipe(
    error,
    Schema.decodeEffect(
      Schema.Union([
        DefaultTaggedClass(QueryResultAppError),
        DefaultTaggedClass(QueryResultParseError),
      ]),
    ),
  );

const parseMutatorResultDetails = (result: MutatorResultDetails) =>
  pipe(
    Match.value(result),
    Match.discriminatorsExhaustive("type")({
      success: () => Effect.void,
      error: (error) =>
        pipe(
          error.error,
          Schema.decodeEffect(
            Schema.Union([
              DefaultTaggedClass(MutatorResultAppError),
              DefaultTaggedClass(MutatorResultZeroError),
            ]),
          ),
        ),
    }),
  );

/**
 * ZeroService provides access to a Zero instance.
 */
export const ZeroService = <S extends ZeroSchema, MD extends CustomMutatorDefs | undefined, C>() =>
  ServiceMap.Service<ZeroServiceTag<S, MD, C>, ZeroService<S, MD, C>>()("ZeroService", {
    make: (zero: Zero<S, MD, C>) =>
      Effect.succeed({
        zero,
        run: Effect.fn("ZeroService.run")(function* <TReturn>(
          query: QueryOrQueryRequest<any, any, any, S, TReturn, C>,
          runOptions?: RunOptions,
        ) {
          return yield* Effect.tryPromise({
            try: () => zero.run(query, runOptions),
            catch: (error) => error as ErroredQuery,
          }).pipe(
            Effect.catch((error) =>
              parseQueryErrorResultDetails(error).pipe(Effect.flatMap(Effect.fail)),
            ),
          );
        }),
        mutate: Effect.fn("ZeroService.mutate")(function* (request: MutateRequest<any, S, C, any>) {
          const { client, server } = yield* Effect.sync(() => zero.mutate(request));

          return {
            client: Effect.fn("ZeroService.mutate.client")(() =>
              Effect.promise(() => client).pipe(Effect.flatMap(parseMutatorResultDetails)),
            ),
            server: Effect.fn("ZeroService.mutate.server")(() =>
              pipe(
                Effect.promise(() => server),
                Effect.flatMap(parseMutatorResultDetails),
              ),
            ),
          };
        }),
      }),
  });
