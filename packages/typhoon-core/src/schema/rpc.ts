import {
  Data,
  Option,
  DateTime,
  Either,
  Schema,
  pipe,
  Match,
  flow,
  Function,
  Unify,
} from "effect";
import { makeRpcError, type RpcError, ValidationError } from "../error";

const LoadingTaggedClass: new () => { readonly _tag: "Loading" } =
  Data.TaggedClass("Loading")<{}>;

/**
 * RPC result type indicating the RPC is loading.
 */
export class Loading extends LoadingTaggedClass {}

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
) => Readonly<ResolvedData<A, E>> & { readonly _tag: "Resolved" } =
  Data.TaggedClass("Resolved");

/**
 * RPC result type indicating the RPC is resolved.
 */
export class Resolved<A, E> extends ResolvedTaggedClass<A, E> {}

/**
 * RPC result type, either Loading or Resolved.
 */
export type RpcResult<A, E> = Loading | Resolved<A, E>;

const mapRpcResult =
  <A, B>(f: (a: A) => B) =>
  <E>(result: RpcResult<A, E>): RpcResult<B, E> =>
    pipe(
      Match.value(result),
      Match.tagsExhaustive({
        Loading: () => new Loading(),
        Resolved: ({ timestamp, value, span }) =>
          new Resolved({ timestamp, value: Either.map(value, f), span }),
      }),
    );

const mapLeftRpcResult =
  <E, F>(schema: Schema.Schema<F, any, any>, f: (e: E) => F) =>
  <A>(result: RpcResult<A, E>): RpcResult<A, F> =>
    pipe(
      Match.value(result),
      Match.tagsExhaustive({
        Loading: () => new Loading(),
        Resolved: ({ timestamp, value, span }) =>
          new Resolved({
            timestamp,
            value: Either.mapLeft(
              value,
              flow(
                Match.value,
                Match.tagsExhaustive({
                  RpcError: (error) =>
                    makeRpcError(schema)(error.message, f(error.cause)),
                  ValidationError: Function.identity<ValidationError>,
                }),
                (v) => v,
              ),
            ),
            span,
          }),
      }),
    );

const matchRpcResult =
  <A, E, LB, RB>(f: {
    onLoading: () => LB;
    onResolved: (value: Resolved<A, E>) => RB;
  }) =>
  (result: RpcResult<A, E>): Unify.Unify<LB | RB> =>
    pipe(
      Match.value(result),
      Match.tagsExhaustive({
        Loading: () => f.onLoading(),
        Resolved: (value) => f.onResolved(value),
      }),
    );

export const RpcResult = {
  map: mapRpcResult,
  mapLeft: mapLeftRpcResult,
  match: matchRpcResult,
};
