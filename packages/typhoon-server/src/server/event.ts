import {
  Context,
  Effect,
  Exit,
  Option,
  pipe,
  Scope,
  SynchronizedRef,
} from "effect";
import { HandlerConfig } from "typhoon-core/config";
import { Msgpack, Stream } from "typhoon-core/protocol";
import { Computed, Signal } from "typhoon-core/signal";
import { validate } from "typhoon-core/validator";

const pullStreamToParsed =
  <const RequestParams extends HandlerConfig.RequestParamsConfig | undefined>(
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
        validate(HandlerConfig.resolveRequestParamsValidator(requestParams)),
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

export const fromEventContext = (
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

export const request = {
  raw: () =>
    pipe(
      Event,
      Effect.flatMap((ref) => SynchronizedRef.get(ref)),
      Effect.map((ctx) => ctx.pullStream),
      Computed.map((pullStream) => pullStream.stream),
    ),
  parsed: <
    Config extends
      | HandlerConfig.SubscriptionHandlerConfig
      | HandlerConfig.MutationHandlerConfig,
  >(
    config: Config,
  ) =>
    pipe(
      request.raw(),
      Computed.flatMap(pullStreamToParsed(HandlerConfig.requestParams(config))),
    ),
};

export const token = (): Effect.Effect<Option.Option<string>, never, Event> =>
  pipe(
    Event,
    Effect.flatMap((ref) => SynchronizedRef.get(ref)),
    Effect.map((ctx) => ctx.token),
  );
