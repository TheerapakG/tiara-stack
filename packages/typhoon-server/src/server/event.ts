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
import {
  MsgpackDecodeError,
  StreamExhaustedError,
} from "typhoon-core/protocol";
import { validate } from "typhoon-core/schema";
import { Computed, signal, Signal } from "typhoon-core/signal";

const pullStreamToParsed =
  <const RequestParams extends HandlerConfig.RequestParamsConfig | undefined>(
    requestParams: RequestParams,
  ) =>
  (
    pullStream: Effect.Effect<
      unknown,
      MsgpackDecodeError | StreamExhaustedError,
      never
    >,
  ) =>
    pipe(
      pullStream,
      Effect.flatMap(
        validate(HandlerConfig.resolveRequestParamsValidator(requestParams)),
      ),
    );

export class EventRequestWithConfig<
  const Config extends
    | HandlerConfig.SubscriptionHandlerConfig
    | HandlerConfig.MutationHandlerConfig,
> {
  constructor(readonly config: Config) {}

  raw() {
    return pipe(
      Event,
      Effect.flatMap((ref) => SynchronizedRef.get(ref)),
      Effect.map((ctx) => ctx.pullStream),
      Computed.map((pullStream) => pullStream.stream),
    );
  }

  parsed() {
    return pipe(
      this.raw(),
      Computed.flatMap(
        pullStreamToParsed(HandlerConfig.requestParams(this.config)),
      ),
    );
  }
}

export class EventWithConfig<
  Config extends
    | HandlerConfig.SubscriptionHandlerConfig
    | HandlerConfig.MutationHandlerConfig,
> {
  constructor(readonly config: Config) {}

  get request() {
    return new EventRequestWithConfig(this.config);
  }
}

type EventContext = {
  request: Request;
  pullStream: {
    stream: Effect.Effect<
      unknown,
      MsgpackDecodeError | StreamExhaustedError,
      never
    >;
    scope: Scope.CloseableScope;
  };
  token: Option.Option<string>;
};

export class Event extends Context.Tag("Event")<
  Event,
  SynchronizedRef.SynchronizedRef<{
    request: Request;
    pullStream: Signal<
      Readonly<{
        stream: Effect.Effect<
          unknown,
          MsgpackDecodeError | StreamExhaustedError,
          never
        >;
        scope: Scope.CloseableScope;
      }>
    >;
    token: Option.Option<string>;
  }>
>() {
  static fromEventContext = (
    ctx: EventContext,
  ): Effect.Effect<Context.Tag.Service<Event>> =>
    SynchronizedRef.make({
      request: ctx.request,
      pullStream: signal({
        stream: ctx.pullStream.stream,
        scope: ctx.pullStream.scope,
      }),
      token: ctx.token,
    });

  static replaceToken = (
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

  static replacePullStream = ({
    stream,
    scope,
  }: {
    stream: Effect.Effect<
      unknown,
      MsgpackDecodeError | StreamExhaustedError,
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

  static close = (): Effect.Effect<void, never, Event> =>
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

  static webRequest = (): Effect.Effect<Request, never, Event> =>
    pipe(
      Event,
      Effect.flatMap((ref) => SynchronizedRef.get(ref)),
      Effect.map((ctx) => ctx.request),
    );

  static token = (): Effect.Effect<Option.Option<string>, never, Event> =>
    pipe(
      Event,
      Effect.flatMap((ref) => SynchronizedRef.get(ref)),
      Effect.map((ctx) => ctx.token),
    );

  static withConfig<
    Config extends
      | HandlerConfig.SubscriptionHandlerConfig
      | HandlerConfig.MutationHandlerConfig,
  >(config: Config) {
    return new EventWithConfig(config);
  }
}
