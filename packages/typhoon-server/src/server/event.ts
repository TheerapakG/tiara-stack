import { Chunk, Console, Context, Effect, Exit, pipe, Scope } from "effect";
import {
  HandlerConfig,
  RequestParamsConfig,
  validateRequestParamsConfig,
} from "typhoon-core/config";
import {
  MsgpackDecodeError,
  StreamExhaustedError,
} from "typhoon-core/protocol";
import { signal, Signal } from "typhoon-core/signal";

const pullStreamToParsed =
  <RequestParams extends RequestParamsConfig | undefined>(
    requestParams: RequestParams,
  ) =>
  (pullStream: Effect.Effect<Chunk.Chunk<unknown>, unknown, never>) =>
    pipe(
      pullStream,
      Effect.flatMap(Chunk.get(0)),
      Effect.flatMap(validateRequestParamsConfig(requestParams)),
    );

export class EventRequestWithConfig<Config extends HandlerConfig> {
  constructor(readonly config: Config) {}

  raw() {
    return pipe(
      Event,
      Effect.flatMap((signal) => signal.value),
      Effect.map(({ pullStream }) =>
        pipe(
          pullStream,
          Effect.tap((value) => Console.log(value)),
        ),
      ),
    );
  }

  parsed<
    RequestParams extends
      | RequestParamsConfig
      | undefined = Config["requestParams"],
  >() {
    return pipe(
      this.raw(),
      Effect.flatMap(
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
    Chunk.Chunk<unknown>,
    MsgpackDecodeError | StreamExhaustedError,
    never
  >;
  scope: Scope.CloseableScope;
};

export class Event extends Context.Tag("Event")<
  Event,
  Signal<{
    readonly pullStream: Effect.Effect<
      Chunk.Chunk<unknown>,
      MsgpackDecodeError | StreamExhaustedError,
      never
    >;
    readonly scope: Scope.CloseableScope;
  }>
>() {
  static fromPullStreamContext(
    ctx: PullStreamContext,
  ): Context.Tag.Service<Event> {
    return signal({ pullStream: ctx.pullStream, scope: ctx.scope });
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

  static withConfig<Config extends HandlerConfig>(config: Config) {
    return new EventWithConfig(config);
  }
}
