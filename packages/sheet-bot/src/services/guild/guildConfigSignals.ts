import { Effect, Either, Function, pipe } from "effect";
import { Schema } from "sheet-apis";
import { Result, RpcResult } from "typhoon-core/schema";
import { Computed, DependencySignal, UntilObserver } from "typhoon-core/signal";

type GuildManagerRolesSignal = DependencySignal.DependencySignal<
  RpcResult.RpcResult<
    Result.Result<
      ReadonlyArray<Schema.GuildConfigManagerRole>,
      ReadonlyArray<Schema.GuildConfigManagerRole>
    >,
    unknown
  >,
  never,
  never
>;

type AutoCheckinGuildsSignal = DependencySignal.DependencySignal<
  RpcResult.RpcResult<
    Result.Result<
      ReadonlyArray<Schema.GuildConfig>,
      ReadonlyArray<Schema.GuildConfig>
    >,
    unknown
  >,
  never,
  never
>;

type GuildConfigSignal = DependencySignal.DependencySignal<
  RpcResult.RpcResult<
    Result.Result<
      Either.Either<Schema.GuildConfig, Schema.Error.Core.ArgumentError>,
      Either.Either<Schema.GuildConfig, Schema.Error.Core.ArgumentError>
    >,
    unknown
  >,
  never,
  never
>;

const waitForEitherResult =
  <A>(optimisticValue: A) =>
  <E, R>(
    signalEffect: Effect.Effect<
      DependencySignal.DependencySignal<
        RpcResult.RpcResult<Result.Result<A, A>, unknown>,
        never,
        never
      >,
      E,
      R
    >,
  ) =>
    pipe(
      signalEffect,
      Effect.flatMap((signal) =>
        pipe(
          Effect.succeed(signal),
          Computed.map(Result.fromRpcReturningResult<A>(optimisticValue)),
          UntilObserver.observeUntilScoped(Result.isComplete),
          Effect.flatMap((result) =>
            pipe(
              result.value,
              Either.match({
                onLeft: (error) => Effect.fail(error),
                onRight: Effect.succeed,
              }),
            ),
          ),
        ),
      ),
    );

export const waitForGuildManagerRoles = <E, R>(
  signalEffect: Effect.Effect<GuildManagerRolesSignal, E, R>,
) =>
  waitForEitherResult<ReadonlyArray<Schema.GuildConfigManagerRole>>([])(
    signalEffect,
  );

export const waitForAutoCheckinGuilds = <E, R>(
  signalEffect: Effect.Effect<AutoCheckinGuildsSignal, E, R>,
) => waitForEitherResult<ReadonlyArray<Schema.GuildConfig>>([])(signalEffect);

export const waitForGuildConfig = <E, R>(
  signalEffect: Effect.Effect<GuildConfigSignal, E, R>,
  { loadingMessage = "Loading guild config" }: { loadingMessage?: string } = {},
) =>
  pipe(
    signalEffect,
    Effect.flatMap((signal) =>
      pipe(
        Effect.succeed(signal),
        Computed.map(
          Result.fromRpcReturningResult<
            Either.Either<Schema.GuildConfig, Schema.Error.Core.ArgumentError>
          >(Either.left(Schema.Error.Core.makeArgumentError(loadingMessage))),
        ),
        UntilObserver.observeUntilScoped(Result.isComplete),
        Effect.flatMap((result) =>
          pipe(
            result.value,
            Either.flatMap(Function.identity),
            Either.match({
              onLeft: (error) => Effect.fail(error),
              onRight: (value) => Effect.succeed(value),
            }),
          ),
        ),
      ),
    ),
  );
