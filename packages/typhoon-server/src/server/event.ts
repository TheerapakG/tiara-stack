import { Context, Effect, Exit, pipe, Scope } from "effect";
import {
  HandlerConfig,
  RequestParamsConfig,
  validateRequestParamsConfig,
} from "typhoon-core/config";
import {
  MsgpackDecodeError,
  StreamExhaustedError,
} from "typhoon-core/protocol";
import { Computed, signal, Signal } from "typhoon-core/signal";

const pullStreamToParsed =
  <RequestParams extends RequestParamsConfig | undefined>(
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
      Effect.flatMap(validateRequestParamsConfig(requestParams)),
    );

export class EventRequestWithConfig<Config extends HandlerConfig> {
  constructor(readonly config: Config) {}

  raw() {
    return pipe(
      Event,
      Computed.map(({ pullStream }) => pullStream),
    );
  }

  parsed<
    RequestParams extends
      | RequestParamsConfig
      | undefined = Config["requestParams"],
  >() {
    return pipe(
      this.raw(),
      Computed.flatMap(
        pullStreamToParsed(this.config.requestParams as RequestParams),
      ),
    );
  }
}

export class EventWithConfig<Config extends HandlerConfig> {
  constructor(readonly config: Config) {}

  get request() {
    return new EventRequestWithConfig(this.config);
  }
}

type PullStreamContext = {
  pullStream: Effect.Effect<
    unknown,
    MsgpackDecodeError | StreamExhaustedError,
    never
  >;
  request: Request;
  scope: Scope.CloseableScope;
};

export class Event extends Context.Tag("Event")<
  Event,
  Signal<Readonly<PullStreamContext>>
>() {
  static fromPullStreamContext(
    ctx: PullStreamContext,
  ): Context.Tag.Service<Event> {
    return signal({
      pullStream: ctx.pullStream,
      request: ctx.request,
      scope: ctx.scope,
    });
  }

  static replaceStreamContext(ctx: PullStreamContext) {
    return pipe(
      Effect.Do,
      Effect.bind("signal", () => Event),
      Effect.bind("oldScope", ({ signal }) =>
        pipe(
          signal.peek(),
          Effect.map(({ scope }) => scope),
        ),
      ),
      Effect.tap(({ signal }) => signal.setValue(ctx)),
      Effect.tap(({ oldScope }) => Scope.close(oldScope, Exit.void)),
      Effect.map(({ signal }) => signal),
    );
  }

  static close() {
    return pipe(
      Effect.Do,
      Effect.bind("signal", () => Event),
      Effect.bind("oldScope", ({ signal }) =>
        pipe(
          signal.peek(),
          Effect.map(({ scope }) => scope),
        ),
      ),
      Effect.tap(({ oldScope }) => Scope.close(oldScope, Exit.void)),
    );
  }

  static webRequest() {
    return pipe(
      Event,
      Computed.map(({ request }) => request),
    );
  }

  static withConfig<Config extends HandlerConfig>(config: Config) {
    return new EventWithConfig(config);
  }
}
