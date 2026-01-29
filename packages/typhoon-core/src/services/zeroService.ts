import { Context, Effect, Match, pipe, Schema, Types } from "effect";
import type {
  Zero,
  Schema as ZeroSchema,
  CustomMutatorDefs,
  QueryOrQueryRequest,
  RunOptions,
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
 * ZeroService provides access to a Zero instance.
 */
export interface ZeroService<
  S extends ZeroSchema,
  MD extends CustomMutatorDefs | undefined,
  C,
> extends Variance<S, MD, C> {}

/**
 * ZeroService provides access to a Zero instance.
 */
export const ZeroService = <S extends ZeroSchema, MD extends CustomMutatorDefs | undefined, C>() =>
  Context.GenericTag<ZeroService<S, MD, C>, Zero<S, MD, C>>("ZeroService");

export const make = <S extends ZeroSchema, MD extends CustomMutatorDefs | undefined, C>(
  zero: Zero<S, MD, C>,
) => Context.make(ZeroService<S, MD, C>(), zero);

const parseQueryErrorResultDetails = (error: ErroredQuery) =>
  pipe(
    error,
    Schema.decode(
      Schema.Union(
        DefaultTaggedClass(QueryResultAppError),
        DefaultTaggedClass(QueryResultParseError),
      ),
    ),
  );

export const run = <S extends ZeroSchema, TReturn, C>(
  query: QueryOrQueryRequest<any, any, any, S, TReturn, C>,
  runOptions?: RunOptions,
) =>
  pipe(
    ZeroService<S, any, C>(),
    Effect.flatMap((zero) => Effect.tryPromise(() => zero.run(query, runOptions))),
    Effect.catchAll((error) =>
      pipe(error.error as ErroredQuery, parseQueryErrorResultDetails, Effect.merge, Effect.flip),
    ),
    // Note: Zero currently seems to have a bug where the promise returned by the query is rejected with the query result instead of an error.
    // This would error with a ParseError instead of the actual error until Zero is fixed.
    // TODO: Remove this note once Zero is fixed.
  );

const parseMutatorResultDetails = (result: MutatorResultDetails) =>
  pipe(
    Match.value(result),
    Match.discriminatorsExhaustive("type")({
      success: () => Effect.void,
      error: (error) =>
        pipe(
          error.error,
          Schema.decode(
            Schema.Union(
              DefaultTaggedClass(MutatorResultAppError),
              DefaultTaggedClass(MutatorResultZeroError),
            ),
          ),
        ),
    }),
  );

export const mutate = <S extends ZeroSchema, C>(request: MutateRequest<any, S, C, any>) =>
  pipe(
    ZeroService<S, any, C>(),
    Effect.map((zero) => zero.mutate(request)),
    Effect.map(({ client, server }) => ({
      client: () =>
        pipe(
          Effect.promise(() => client),
          Effect.flatMap(parseMutatorResultDetails),
        ),
      server: () =>
        pipe(
          Effect.promise(() => server),
          Effect.flatMap(parseMutatorResultDetails),
        ),
    })),
  );
