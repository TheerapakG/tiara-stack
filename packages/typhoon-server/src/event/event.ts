import { Context, Effect, Exit, Option, pipe, Scope, SynchronizedRef } from "effect";
import { Handler } from "typhoon-core/server";
import { Signal, SignalContext, Computed, SignalService } from "typhoon-core/signal";
import { Validate, Validator } from "typhoon-core/validator";
import {
  AuthorizationError,
  makeAuthorizationError,
  MsgpackDecodeError,
  StreamExhaustedError,
} from "typhoon-core/error";
export type { Validator };

export type MsgpackPullEffect = Effect.Effect<
  unknown,
  MsgpackDecodeError | StreamExhaustedError,
  never
>;

const pullEffectToParsed =
  <const RequestParams extends Handler.Config.Shared.RequestParams.RequestParamsConfig | undefined>(
    requestParams: RequestParams,
  ) =>
  (pullEffect: MsgpackPullEffect) =>
    pipe(
      pullEffect,
      Effect.flatMap(
        Validate.validate(Handler.Config.resolveRequestParamsValidator(requestParams)),
      ),
    );

type EventContext = {
  handler: Option.Option<string>;
  request: Request;
  token: Option.Option<string>;
  pullEffect: {
    effect: MsgpackPullEffect;
    scope: Scope.CloseableScope;
  };
};

export class Event extends Context.Tag("Event")<
  Event,
  SynchronizedRef.SynchronizedRef<{
    handler: Option.Option<string>;
    request: Request;
    token: Option.Option<string>;
    pullEffect: Signal.Signal<
      Readonly<{
        effect: MsgpackPullEffect;
        scope: Scope.CloseableScope;
      }>
    >;
  }>
>() {}

export const makeEventService = (
  ctx: EventContext,
): Effect.Effect<Context.Tag.Service<Event>, never, SignalService.SignalService> =>
  pipe(
    Signal.make({
      effect: ctx.pullEffect.effect,
      scope: ctx.pullEffect.scope,
    }),
    Effect.flatMap((pullEffect) =>
      SynchronizedRef.make({
        handler: ctx.handler,
        request: ctx.request,
        token: ctx.token,
        pullEffect,
      }),
    ),
  );

export const replaceToken = (
  token: Option.Option<string>,
): Effect.Effect<Context.Tag.Service<Event>, never, Event> =>
  pipe(
    Effect.Do,
    Effect.bind("ref", () => Event),
    Effect.bind("oldContext", ({ ref }) => SynchronizedRef.get(ref)),
    Effect.tap(({ ref, oldContext }) =>
      SynchronizedRef.update(ref, () => ({ ...oldContext, token })),
    ),
    Effect.map(({ ref }) => ref),
  );

export const replacePullStream = ({
  effect,
  scope,
}: {
  effect: MsgpackPullEffect;
  scope: Scope.CloseableScope;
}): Effect.Effect<Context.Tag.Service<Event>, never, Event | SignalService.SignalService> =>
  pipe(
    Effect.Do,
    Effect.bind("ref", () => Event),
    Effect.bind("oldContext", ({ ref }) => SynchronizedRef.get(ref)),
    Effect.bind("oldPullStream", ({ oldContext }) => oldContext.pullEffect.peek()),
    Effect.tap(({ oldContext }) => oldContext.pullEffect.setValue({ effect, scope })),
    Effect.tap(({ oldPullStream }) => Scope.close(oldPullStream.scope, Exit.void)),
    Effect.map(({ ref }) => ref),
  );

export const close = (): Effect.Effect<void, never, Event> =>
  pipe(
    Effect.Do,
    Effect.bind("ref", () => Event),
    Effect.bind("oldContext", ({ ref }) => SynchronizedRef.get(ref)),
    Effect.bind("oldPullStream", ({ oldContext }) => oldContext.pullEffect.peek()),
    Effect.tap(({ oldPullStream }) => Scope.close(oldPullStream.scope, Exit.void)),
  );

export const handler = (): Effect.Effect<Option.Option<string>, never, Event> =>
  pipe(
    Event,
    Effect.flatMap((ref) => SynchronizedRef.get(ref)),
    Effect.map((ctx) => ctx.handler),
  );

export const webRequest = (): Effect.Effect<Request, never, Event> =>
  pipe(
    Event,
    Effect.flatMap((ref) => SynchronizedRef.get(ref)),
    Effect.map((ctx) => ctx.request),
  );

export const token = (): Effect.Effect<Option.Option<string>, never, Event> =>
  pipe(
    Event,
    Effect.flatMap((ref) => SynchronizedRef.get(ref)),
    Effect.map((ctx) => ctx.token),
  );

export const someToken = (): Effect.Effect<string, AuthorizationError, Event> =>
  pipe(
    token(),
    Effect.flatMap(
      Option.match({
        onSome: Effect.succeed,
        onNone: () => Effect.fail(makeAuthorizationError("No authorization token found for event")),
      }),
    ),
  );

export const pullEffect = (): Effect.Effect<
  Signal.Signal<{
    effect: MsgpackPullEffect;
    scope: Scope.CloseableScope;
  }>,
  never,
  Event
> =>
  pipe(
    Event,
    Effect.flatMap((ref) => SynchronizedRef.get(ref)),
    Effect.map((ctx) => ctx.pullEffect),
  );

export const request = {
  rawWithScope: (): Effect.Effect<
    Effect.Effect<
      {
        effect: MsgpackPullEffect;
        scope: Scope.CloseableScope;
      },
      never,
      SignalContext.SignalContext | SignalService.SignalService
    >,
    never,
    Event
  > =>
    pipe(
      Effect.Do,
      Effect.bind("pullEffect", () => pullEffect()),
      Effect.bind("computed", ({ pullEffect }) =>
        Computed.make(
          pipe(
            pullEffect,
            Effect.flatMap(({ effect, scope }) =>
              Effect.all({
                effect: Effect.cached(effect),
                scope: Effect.succeed(scope),
              }),
            ),
          ),
        ),
      ),
      Effect.map(({ computed }) => computed),
      Effect.map(
        Effect.withSpan("Event.request.rawWithScope", {
          captureStackTrace: true,
        }),
      ),
    ),
  raw: (): Effect.Effect<
    Effect.Effect<
      MsgpackPullEffect,
      never,
      SignalContext.SignalContext | SignalService.SignalService
    >,
    never,
    Event
  > =>
    pipe(
      request.rawWithScope(),
      Effect.map(Effect.map(({ effect }) => effect)),
      Effect.map(
        Effect.withSpan("Event.request.raw subscription", {
          captureStackTrace: true,
        }),
      ),
      Effect.map(Effect.withSpan("Event.request.raw", { captureStackTrace: true })),
    ),
  parsedWithScope: <Config extends Handler.Config.TypedHandlerConfig>(config: Config) =>
    pipe(
      request.rawWithScope(),
      Effect.map(
        Effect.flatMap(({ effect, scope }) =>
          Effect.all({
            parsed: pipe(effect, pullEffectToParsed(Handler.Config.requestParams(config))),
            scope: Effect.succeed(scope),
          }),
        ),
      ),
      Effect.map(
        Effect.withSpan("Event.request.parsedWithScope subscription", {
          captureStackTrace: true,
        }),
      ),
      Effect.map(
        Effect.withSpan("Event.request.parsedWithScope", {
          captureStackTrace: true,
        }),
      ),
    ),
  parsed: <Config extends Handler.Config.TypedHandlerConfig>(config: Config) =>
    pipe(
      request.raw(),
      Effect.map(Effect.flatMap(pullEffectToParsed(Handler.Config.requestParams(config)))),
      Effect.map(
        Effect.withSpan("Event.request.parsed subscription", {
          captureStackTrace: true,
        }),
      ),
      Effect.map(Effect.withSpan("Event.request.parsed", { captureStackTrace: true })),
    ),
};
