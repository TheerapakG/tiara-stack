import {
  Context,
  Effect,
  Exit,
  Option,
  pipe,
  Scope,
  SynchronizedRef,
} from "effect";
import { Handler } from "typhoon-core/server";
import { Msgpack, Stream } from "typhoon-core/protocol";
import { Computed, Signal } from "typhoon-core/signal";
import { Validate, Validator } from "typhoon-core/validator";
import { Authorization } from "typhoon-core/error";

export type { Validator };

const pullStreamToParsed =
  <
    const RequestParams extends
      | Handler.Config.Shared.RequestParams.RequestParamsConfig
      | undefined,
  >(
    requestParams: RequestParams,
  ) =>
  (
    pullStream: Effect.Effect<
      unknown,
      Msgpack.Decoder.MsgpackDecodeError | Stream.StreamExhaustedError,
      never
    >,
  ) =>
    pipe(
      pullStream,
      Effect.flatMap(
        Validate.validate(
          Handler.Config.resolveRequestParamsValidator(requestParams),
        ),
      ),
    );

type EventContext = {
  request: Request;
  token: Option.Option<string>;
  pullStream: {
    stream: Effect.Effect<
      unknown,
      Msgpack.Decoder.MsgpackDecodeError | Stream.StreamExhaustedError,
      never
    >;
    scope: Scope.CloseableScope;
  };
};

export class Event extends Context.Tag("Event")<
  Event,
  SynchronizedRef.SynchronizedRef<{
    request: Request;
    token: Option.Option<string>;
    pullStream: Signal.Signal<
      Readonly<{
        stream: Effect.Effect<
          unknown,
          Msgpack.Decoder.MsgpackDecodeError | Stream.StreamExhaustedError,
          never
        >;
        scope: Scope.CloseableScope;
      }>
    >;
  }>
>() {}

export const makeEventService = (
  ctx: EventContext,
): Effect.Effect<Context.Tag.Service<Event>> =>
  SynchronizedRef.make({
    request: ctx.request,
    token: ctx.token,
    pullStream: Signal.make({
      stream: ctx.pullStream.stream,
      scope: ctx.pullStream.scope,
    }),
  });

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
  stream,
  scope,
}: {
  stream: Effect.Effect<
    unknown,
    Msgpack.Decoder.MsgpackDecodeError | Stream.StreamExhaustedError,
    never
  >;
  scope: Scope.CloseableScope;
}): Effect.Effect<Context.Tag.Service<Event>, never, Event> =>
  pipe(
    Effect.Do,
    Effect.bind("ref", () => Event),
    Effect.bind("oldContext", ({ ref }) => SynchronizedRef.get(ref)),
    Effect.bind("oldPullStream", ({ oldContext }) =>
      oldContext.pullStream.peek(),
    ),
    Effect.tap(({ oldContext }) =>
      oldContext.pullStream.setValue({ stream, scope }),
    ),
    Effect.tap(({ oldPullStream }) =>
      Scope.close(oldPullStream.scope, Exit.void),
    ),
    Effect.map(({ ref }) => ref),
  );

export const close = (): Effect.Effect<void, never, Event> =>
  pipe(
    Effect.Do,
    Effect.bind("ref", () => Event),
    Effect.bind("oldContext", ({ ref }) => SynchronizedRef.get(ref)),
    Effect.bind("oldPullStream", ({ oldContext }) =>
      oldContext.pullStream.peek(),
    ),
    Effect.tap(({ oldPullStream }) =>
      Scope.close(oldPullStream.scope, Exit.void),
    ),
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

export const someToken = (): Effect.Effect<
  string,
  Authorization.AuthorizationError,
  Event
> =>
  pipe(
    token(),
    Effect.flatMap(
      Option.match({
        onSome: Effect.succeed,
        onNone: () =>
          Effect.fail(
            Authorization.makeAuthorizationError(
              "No authorization token found for event",
            ),
          ),
      }),
    ),
  );

export const pullStream = (): Effect.Effect<
  Signal.Signal<{
    stream: Effect.Effect<
      unknown,
      Msgpack.Decoder.MsgpackDecodeError | Stream.StreamExhaustedError,
      never
    >;
    scope: Scope.CloseableScope;
  }>,
  never,
  Event
> =>
  pipe(
    Event,
    Effect.flatMap((ref) => SynchronizedRef.get(ref)),
    Effect.map((ctx) => ctx.pullStream),
  );

export const request = {
  raw: () =>
    pipe(
      pullStream(),
      Computed.map((pullStream) => pullStream.stream),
    ),
  parsed: <Config extends Handler.Config.TypedHandlerConfig>(config: Config) =>
    pipe(
      request.raw(),
      Computed.flatMap(
        pullStreamToParsed(Handler.Config.requestParams(config)),
      ),
    ),
};
