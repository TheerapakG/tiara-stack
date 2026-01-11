import { Data, Option, DateTime, Either, pipe, Match, flow, Function, Unify } from "effect";
import { RpcError, ValidationError } from "../../error";

const LoadingTaggedClass: new () => { readonly _tag: "Loading" } = Data.TaggedClass("Loading")<{}>;

/**
 * RPC result type indicating the RPC is loading.
 */
export class Loading extends LoadingTaggedClass {}

/**
 * Create a new Loading RPC result.
 */
export const loading = () => new Loading();

type ResolvedData<A, E> = {
  readonly timestamp: Option.Option<DateTime.DateTime>;
  readonly value: Either.Either<A, RpcError<E> | ValidationError>;
  readonly span?: {
    readonly traceId: string;
    readonly spanId: string;
  };
};
const ResolvedTaggedClass: new <A, E>(
  args: Readonly<ResolvedData<A, E>>,
) => Readonly<ResolvedData<A, E>> & { readonly _tag: "Resolved" } = Data.TaggedClass("Resolved");

/**
 * RPC result type indicating the RPC is resolved.
 */
export class Resolved<A, E> extends ResolvedTaggedClass<A, E> {}

/**
 * Create a new Resolved RPC result.
 */
export const resolved = <A, E>(
  timestamp: Option.Option<DateTime.DateTime>,
  value: Either.Either<A, RpcError<E> | ValidationError>,
  span?: { traceId: string; spanId: string },
) => new Resolved({ timestamp, value, span });

/**
 * RPC result type, either Loading or Resolved.
 */
export type RpcResult<A, E> = Loading | Resolved<A, E>;

export const map =
  <A, B>(f: (a: A) => B) =>
  <E>(result: RpcResult<A, E>): RpcResult<B, E> =>
    pipe(
      Match.value(result),
      Match.tagsExhaustive({
        Loading: () => loading(),
        Resolved: ({ timestamp, value, span }) => resolved(timestamp, Either.map(value, f), span),
      }),
    );

export const mapLeft =
  <E, F>(f: (e: E) => F) =>
  <A>(result: RpcResult<A, E>): RpcResult<A, F> =>
    pipe(
      Match.value(result),
      Match.tagsExhaustive({
        Loading: () => loading(),
        Resolved: ({ timestamp, value, span }) =>
          resolved(
            timestamp,
            Either.mapLeft(
              value,
              flow(
                Match.value,
                Match.tagsExhaustive({
                  RpcError: (error) =>
                    new RpcError({
                      message: error.message,
                      cause: f(error.cause),
                    }),
                  ValidationError: Function.identity<ValidationError>,
                }),
                (v) => v,
              ),
            ),
            span,
          ),
      }),
    );

export const match =
  <A, E, LB, RB>(f: { onLoading: () => LB; onResolved: (value: Resolved<A, E>) => RB }) =>
  (result: RpcResult<A, E>): Unify.Unify<LB | RB> =>
    pipe(
      Match.value(result),
      Match.tagsExhaustive({
        Loading: () => f.onLoading(),
        Resolved: (value) => f.onResolved(value),
      }),
    );

export const isLoading = (result: unknown): result is Loading => result instanceof Loading;

export const isResolved = (result: unknown): result is Resolved<unknown, unknown> =>
  result instanceof Resolved;
