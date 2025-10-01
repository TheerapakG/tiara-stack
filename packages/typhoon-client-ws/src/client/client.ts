import type { StandardSchemaV1 } from "@standard-schema/spec";
import {
  Data,
  DateTime,
  Deferred,
  Effect,
  HashMap,
  Match,
  Option,
  Order,
  pipe,
  Schedule,
  Schema,
  String,
  SynchronizedRef,
} from "effect";
import { Handler } from "typhoon-core/server";
import { Header, Msgpack, Stream } from "typhoon-core/protocol";
import { DependencySignal, Signal } from "typhoon-core/signal";
import { Validate, Validator } from "typhoon-core/validator";

const WebSocketCtor = globalThis.WebSocket;

export class HandlerError extends Data.TaggedError("HandlerError") {}

type LoadingState = {
  state: "loading";
};

type ResolvedState<T = unknown> = {
  state: "resolved";
  timestamp: DateTime.DateTime;
  value: Effect.Effect<T, HandlerError, never>;
};

type SignalState<T = unknown> = LoadingState | ResolvedState<T>;

type UpdaterState<T = unknown> = {
  updater: (value: ResolvedState<T>) => Effect.Effect<void, never, never>;
};
type UpdaterStateMap = HashMap.HashMap<string, UpdaterState>;

export class WebSocketClient<
  SubscriptionHandlerConfigs extends Record<
    string,
    Handler.Config.Subscription.SubscriptionHandlerConfig
  > = Record<string, Handler.Config.Subscription.SubscriptionHandlerConfig>,
  MutationHandlerConfigs extends Record<
    string,
    Handler.Config.Mutation.MutationHandlerConfig
  > = Record<string, Handler.Config.Mutation.MutationHandlerConfig>,
> {
  constructor(
    private readonly url: string,
    private readonly ws: SynchronizedRef.SynchronizedRef<
      Option.Option<WebSocket>
    >,
    private readonly updaterStateMapRef: SynchronizedRef.SynchronizedRef<UpdaterStateMap>,
    private readonly configCollection: Handler.Config.Collection.HandlerConfigCollection<
      SubscriptionHandlerConfigs,
      MutationHandlerConfigs
    >,
    private readonly token: SynchronizedRef.SynchronizedRef<
      Option.Option<string>
    >,
    private readonly status: SynchronizedRef.SynchronizedRef<
      "disconnecting" | "disconnected" | "connecting" | "connected"
    >,
  ) {}

  static create<
    SubscriptionHandlerConfigs extends Record<
      string,
      Handler.Config.Subscription.SubscriptionHandlerConfig
    >,
    MutationHandlerConfigs extends Record<
      string,
      Handler.Config.Mutation.MutationHandlerConfig
    >,
  >(
    configCollection: Handler.Config.Collection.HandlerConfigCollection<
      SubscriptionHandlerConfigs,
      MutationHandlerConfigs
    >,
    url: string,
  ): Effect.Effect<
    WebSocketClient<SubscriptionHandlerConfigs, MutationHandlerConfigs>,
    never,
    never
  > {
    return pipe(
      Effect.Do,
      Effect.bind("ws", () => SynchronizedRef.make(Option.none<WebSocket>())),
      Effect.bind("updaterStateMapRef", () =>
        SynchronizedRef.make(HashMap.empty<string, UpdaterState>()),
      ),
      Effect.bind("token", () => SynchronizedRef.make(Option.none<string>())),
      Effect.bind("status", () =>
        SynchronizedRef.make<
          "disconnected" | "disconnecting" | "connecting" | "connected"
        >("disconnected"),
      ),
      Effect.map(
        ({ ws, updaterStateMapRef, token, status }) =>
          new WebSocketClient<
            SubscriptionHandlerConfigs,
            MutationHandlerConfigs
          >(url, ws, updaterStateMapRef, configCollection, token, status),
      ),
      Effect.withSpan("WebSocketClient.create"),
    );
  }

  static addUpdater(
    id: string,
    updater: (
      value: ResolvedState<unknown>,
    ) => Effect.Effect<void, never, never>,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (client: WebSocketClient<any, any>) =>
      pipe(
        client.updaterStateMapRef,
        SynchronizedRef.update(HashMap.set(id, { updater })),
      );
  }

  static removeUpdater(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (client: WebSocketClient<any, any>) =>
      pipe(
        client.updaterStateMapRef,
        SynchronizedRef.update(HashMap.remove(id)),
      );
  }

  static handleUpdate(header: Header.Header, decodedResponse: unknown) {
    return (
      client: WebSocketClient<
        Record<string, Handler.Config.Subscription.SubscriptionHandlerConfig>,
        Record<string, Handler.Config.Mutation.MutationHandlerConfig>
      >,
    ) =>
      pipe(
        client.updaterStateMapRef,
        SynchronizedRef.get,
        Effect.map(HashMap.get(header.id)),
        // TODO: validate message
        Effect.tap((updaterState) =>
          pipe(
            updaterState,
            Option.match({
              onSome: ({ updater }) =>
                pipe(
                  Match.value(header),
                  Match.when({ action: "server:update" }, (header) =>
                    pipe(
                      DateTime.make(header.payload.timestamp),
                      Effect.transposeMapOption((timestamp) =>
                        updater({
                          state: "resolved",
                          timestamp,
                          value: header.payload.success
                            ? Effect.succeed(decodedResponse)
                            : Effect.fail(
                                new HandlerError(decodedResponse as void),
                              ),
                        }),
                      ),
                    ),
                  ),
                  Match.orElse(() => Effect.void),
                ),
              onNone: () => Effect.void,
            }),
          ),
        ),
      );
  }

  static connect = (
    client: WebSocketClient<
      Record<string, Handler.Config.Subscription.SubscriptionHandlerConfig>,
      Record<string, Handler.Config.Mutation.MutationHandlerConfig>
    >,
  ) =>
    pipe(
      Effect.Do,
      Effect.tap(() =>
        SynchronizedRef.update(client.status, () => "connecting" as const),
      ),
      Effect.bind("latch", () => Effect.makeLatch()),
      Effect.tap(({ latch }) =>
        pipe(
          client.ws,
          SynchronizedRef.updateEffect(() => {
            const ws = new WebSocketCtor(client.url);
            ws.binaryType = "blob";
            ws.addEventListener("message", (event) =>
              Effect.runPromise(
                pipe(
                  Effect.Do,
                  Effect.let("data", () => event.data as Blob),
                  Effect.bind("pullStream", ({ data }) =>
                    pipe(
                      Msgpack.Decoder.blobToStream(data),
                      Stream.toPullStream,
                    ),
                  ),
                  Effect.bind("header", ({ pullStream }) =>
                    pipe(
                      pullStream,
                      Effect.flatMap(
                        Validate.validate(
                          pipe(Header.HeaderSchema, Schema.standardSchemaV1),
                        ),
                      ),
                    ),
                  ),
                  Effect.bind(
                    "decodedResponse",
                    ({ pullStream }) => pullStream,
                  ),
                  Effect.tap(({ header, decodedResponse }) =>
                    pipe(
                      Match.value(header),
                      Match.when({ action: "server:update" }, (header) =>
                        WebSocketClient.handleUpdate(
                          header,
                          decodedResponse,
                        )(client),
                      ),
                      Match.orElse(() => Effect.void),
                    ),
                  ),
                  Effect.asVoid,
                  Effect.scoped,
                ),
              ),
            );
            ws.addEventListener("open", () => Effect.runPromise(latch.open));
            ws.addEventListener("close", () =>
              Effect.runPromise(
                pipe(
                  WebSocketClient.connect(client),
                  Effect.unlessEffect(
                    pipe(
                      SynchronizedRef.get(client.status),
                      Effect.map((status) =>
                        String.Equivalence(status, "disconnecting"),
                      ),
                    ),
                  ),
                  Effect.retry({
                    schedule: Schedule.exponential(1000),
                    times: 3,
                  }),
                ),
              ),
            );
            return latch.whenOpen(Effect.succeedSome(ws));
          }),
        ),
      ),
      Effect.tap(() =>
        SynchronizedRef.update(client.status, () => "connected" as const),
      ),
      Effect.withSpan("WebSocketClient.connect"),
    );

  static close(
    client: WebSocketClient<
      Record<string, Handler.Config.Subscription.SubscriptionHandlerConfig>,
      Record<string, Handler.Config.Mutation.MutationHandlerConfig>
    >,
  ) {
    return pipe(
      SynchronizedRef.update(client.status, () => "disconnecting" as const),
      Effect.andThen(
        SynchronizedRef.updateEffect(client.ws, (ws) =>
          pipe(
            ws,
            Effect.transposeMapOption((ws) =>
              pipe(
                Effect.makeLatch(),
                Effect.tap((latch) =>
                  ws.addEventListener("close", () =>
                    Effect.runPromise(latch.open),
                  ),
                ),
                Effect.tap(() => ws.close()),
                Effect.flatMap((latch) => latch.whenOpen(Effect.succeedNone)),
              ),
            ),
            Effect.map(Option.flatten),
          ),
        ),
      ),
      Effect.andThen(
        SynchronizedRef.update(client.status, () => "disconnected" as const),
      ),
      Effect.withSpan("WebSocketClient.close"),
    );
  }

  static token =
    (token: Option.Option<string>) =>
    (
      client: WebSocketClient<
        Record<string, Handler.Config.Subscription.SubscriptionHandlerConfig>,
        Record<string, Handler.Config.Mutation.MutationHandlerConfig>
      >,
    ) =>
      pipe(
        SynchronizedRef.update(client.token, () => token),
        Effect.withSpan("WebSocketClient.token"),
      );

  static subscribe<
    SubscriptionHandlerConfigs extends Record<
      string,
      Handler.Config.Subscription.SubscriptionHandlerConfig
    >,
    Handler extends keyof SubscriptionHandlerConfigs & string,
  >(
    client: WebSocketClient<
      SubscriptionHandlerConfigs,
      Record<string, Handler.Config.Mutation.MutationHandlerConfig>
    >,
    handler: Handler,
    // TODO: make this conditionally optional
    data?: Handler.Config.ResolvedRequestParamsValidator<
      Handler.Config.RequestParamsOrUndefined<
        SubscriptionHandlerConfigs[Handler]
      >
    > extends infer Validator extends StandardSchemaV1
      ? StandardSchemaV1.InferInput<Validator>
      : never,
  ) {
    return pipe(
      Effect.Do,
      Effect.let("id", () => crypto.randomUUID() as string),
      Effect.let("signal", () =>
        Signal.make<
          SignalState<
            Validator.Validated<
              Handler.Config.ResolvedResponseValidator<
                Handler.Config.ResponseOrUndefined<
                  SubscriptionHandlerConfigs[Handler]
                >
              >
            >
          >
        >({ state: "loading" }),
      ),
      Effect.tap(({ id, signal }) =>
        pipe(
          client,
          WebSocketClient.addUpdater(id, (value) =>
            signal.updateValue((prev) =>
              Effect.succeed(
                prev.state === "loading" ||
                  Order.lessThan(DateTime.Order)(
                    prev.timestamp,
                    value.timestamp,
                  )
                  ? {
                      state: "resolved",
                      timestamp: value.timestamp,
                      value: pipe(
                        Effect.Do,
                        Effect.bind("value", () => value.value),
                        Effect.bind("config", () =>
                          Handler.Config.Collection.getHandlerConfig(
                            "subscription",
                            handler,
                          )(client.configCollection),
                        ),
                        Effect.flatMap(({ value, config }) =>
                          Validate.validate(
                            Handler.Config.resolveResponseValidator(
                              Handler.Config.response(
                                config as SubscriptionHandlerConfigs[Handler],
                              ),
                            ),
                          )(value),
                        ),
                        Effect.catchAll((error) =>
                          Effect.fail(
                            new HandlerError({
                              cause: error,
                            } as unknown as void),
                          ),
                        ),
                      ),
                    }
                  : prev,
              ),
            ),
          ),
        ),
      ),
      Effect.bind("token", () => client.token),
      Effect.bind("requestHeader", ({ id, token }) =>
        Schema.encode(Header.HeaderSchema)({
          protocol: "typh",
          version: 1,
          id,
          action: "client:subscribe",
          payload: {
            handler: handler,
            token: Option.getOrUndefined(token),
          },
        }),
      ),
      Effect.bind("requestHeaderEncoded", ({ requestHeader }) =>
        Msgpack.Encoder.encode(requestHeader),
      ),
      Effect.bind("dataEncoded", () => Msgpack.Encoder.encode(data)),
      Effect.let("requestBuffer", ({ requestHeaderEncoded, dataEncoded }) => {
        const requestBuffer = new Uint8Array(
          requestHeaderEncoded.length + dataEncoded.length,
        );
        requestBuffer.set(requestHeaderEncoded, 0);
        requestBuffer.set(dataEncoded, requestHeaderEncoded.length);
        return requestBuffer;
      }),
      Effect.bind("ws", () => client.ws),
      Effect.tap(({ ws, requestBuffer }) =>
        Option.map(ws, (ws) => ws.send(requestBuffer)),
      ),
      Effect.map(
        ({ id, signal }) =>
          [
            signal as DependencySignal.DependencySignal<
              SignalState<
                Validator.Validated<
                  Handler.Config.ResolvedResponseValidator<
                    Handler.Config.ResponseOrUndefined<
                      SubscriptionHandlerConfigs[Handler]
                    >
                  >
                >
              >,
              never,
              never
            >,
            WebSocketClient.unsubscribe(client, id, handler),
          ] as const,
      ),
      Effect.withSpan("WebSocketClient.subscribe", {
        attributes: {
          handler,
        },
        captureStackTrace: true,
      }),
    );
  }

  static unsubscribe<
    SubscriptionHandlerConfigs extends Record<
      string,
      Handler.Config.Subscription.SubscriptionHandlerConfig
    >,
    Handler extends keyof SubscriptionHandlerConfigs & string,
  >(
    client: WebSocketClient<
      SubscriptionHandlerConfigs,
      Record<string, Handler.Config.Mutation.MutationHandlerConfig>
    >,
    id: string,
    handler: Handler,
  ) {
    return pipe(
      Effect.Do,
      Effect.tap(() => pipe(client, WebSocketClient.removeUpdater(id))),
      Effect.bind("header", () =>
        Schema.encode(Header.HeaderSchema)({
          protocol: "typh",
          version: 1,
          id,
          action: "client:unsubscribe",
          payload: {
            handler: handler,
          },
        }),
      ),
      Effect.bind("headerEncoded", ({ header }) =>
        Msgpack.Encoder.encode(header),
      ),
      Effect.bind("ws", () => client.ws),
      Effect.tap(({ ws, headerEncoded }) =>
        Option.map(ws, (ws) => ws.send(headerEncoded)),
      ),
      Effect.asVoid,
      Effect.withSpan("WebSocketClient.unsubscribe", {
        attributes: {
          id,
          handler,
        },
        captureStackTrace: true,
      }),
    );
  }

  static once<
    SubscriptionHandlerConfigs extends Record<
      string,
      Handler.Config.Subscription.SubscriptionHandlerConfig
    >,
    Handler extends keyof SubscriptionHandlerConfigs & string,
  >(
    client: WebSocketClient<
      SubscriptionHandlerConfigs,
      Record<string, Handler.Config.Mutation.MutationHandlerConfig>
    >,
    handler: Handler,
    // TODO: make this conditionally optional
    data?: Handler.Config.ResolvedRequestParamsValidator<
      Handler.Config.RequestParamsOrUndefined<
        SubscriptionHandlerConfigs[Handler]
      >
    > extends infer Validator extends StandardSchemaV1
      ? StandardSchemaV1.InferInput<Validator>
      : never,
  ) {
    return pipe(
      Effect.Do,
      Effect.let("id", () => crypto.randomUUID() as string),
      Effect.bind("deferred", () =>
        Deferred.make<
          Validator.Validated<
            Handler.Config.ResolvedResponseValidator<
              Handler.Config.ResponseOrUndefined<
                SubscriptionHandlerConfigs[Handler]
              >
            >
          >,
          HandlerError
        >(),
      ),
      Effect.tap(({ id, deferred }) =>
        pipe(
          client,
          WebSocketClient.addUpdater(id, (value) =>
            pipe(
              deferred,
              Deferred.complete(
                pipe(
                  Effect.Do,
                  Effect.bind("value", () => value.value),
                  Effect.bind("config", () =>
                    Handler.Config.Collection.getHandlerConfig(
                      "subscription",
                      handler,
                    )(client.configCollection),
                  ),
                  Effect.flatMap(({ value, config }) =>
                    Validate.validate(
                      Handler.Config.resolveResponseValidator(
                        Handler.Config.response(
                          config as SubscriptionHandlerConfigs[Handler],
                        ),
                      ),
                    )(value),
                  ),
                  Effect.catchAll((error) =>
                    Effect.fail(
                      new HandlerError({ cause: error } as unknown as void),
                    ),
                  ),
                ),
              ),
              Effect.andThen(() =>
                pipe(client, WebSocketClient.removeUpdater(id)),
              ),
              Effect.asVoid,
            ),
          ),
        ),
      ),
      Effect.bind("token", () => client.token),
      Effect.bind("requestHeader", ({ id, token }) =>
        Schema.encode(Header.HeaderSchema)({
          protocol: "typh",
          version: 1,
          id,
          action: "client:once",
          payload: {
            handler: handler,
            token: Option.getOrUndefined(token),
          },
        }),
      ),
      Effect.bind("requestHeaderEncoded", ({ requestHeader }) =>
        Msgpack.Encoder.encode(requestHeader),
      ),
      Effect.bind("dataEncoded", () => Msgpack.Encoder.encode(data)),
      Effect.let("requestBuffer", ({ requestHeaderEncoded, dataEncoded }) => {
        const requestBuffer = new Uint8Array(
          requestHeaderEncoded.length + dataEncoded.length,
        );
        requestBuffer.set(requestHeaderEncoded, 0);
        requestBuffer.set(dataEncoded, requestHeaderEncoded.length);
        return requestBuffer;
      }),
      Effect.bind("ws", () => client.ws),
      Effect.tap(({ ws, requestBuffer }) =>
        Option.map(ws, (ws) => ws.send(requestBuffer)),
      ),
      Effect.flatMap(({ deferred }) => Deferred.await(deferred)),
      Effect.withSpan("WebSocketClient.once", {
        attributes: {
          handler,
        },
        captureStackTrace: true,
      }),
    );
  }

  static mutate<
    MutationHandlerConfigs extends Record<
      string,
      Handler.Config.Mutation.MutationHandlerConfig
    >,
    Handler extends keyof MutationHandlerConfigs & string,
  >(
    client: WebSocketClient<
      Record<string, Handler.Config.Subscription.SubscriptionHandlerConfig>,
      MutationHandlerConfigs
    >,
    handler: Handler,
    // TODO: make this conditionally optional
    data?: Handler.Config.ResolvedRequestParamsValidator<
      Handler.Config.RequestParamsOrUndefined<MutationHandlerConfigs[Handler]>
    > extends infer Validator extends StandardSchemaV1
      ? StandardSchemaV1.InferInput<Validator>
      : never,
  ) {
    return pipe(
      Effect.Do,
      Effect.let("id", () => crypto.randomUUID() as string),
      Effect.bind("deferred", () =>
        Deferred.make<
          Validator.Validated<
            Handler.Config.ResolvedResponseValidator<
              Handler.Config.ResponseOrUndefined<
                MutationHandlerConfigs[Handler]
              >
            >
          >,
          HandlerError
        >(),
      ),
      Effect.tap(({ id, deferred }) =>
        pipe(
          client,
          WebSocketClient.addUpdater(id, (value) =>
            pipe(
              deferred,
              Deferred.complete(
                pipe(
                  Effect.Do,
                  Effect.bind("value", () => value.value),
                  Effect.bind("config", () =>
                    Handler.Config.Collection.getHandlerConfig(
                      "mutation",
                      handler,
                    )(client.configCollection),
                  ),
                  Effect.flatMap(({ value, config }) =>
                    Validate.validate(
                      Handler.Config.resolveResponseValidator(
                        Handler.Config.response(
                          config as MutationHandlerConfigs[Handler],
                        ),
                      ),
                    )(value),
                  ),
                  Effect.catchAll((error) =>
                    Effect.fail(
                      new HandlerError({ cause: error } as unknown as void),
                    ),
                  ),
                ),
              ),
              Effect.andThen(() =>
                pipe(client, WebSocketClient.removeUpdater(id)),
              ),
              Effect.asVoid,
            ),
          ),
        ),
      ),
      Effect.bind("token", () => client.token),
      Effect.bind("requestHeader", ({ id, token }) =>
        Schema.encode(Header.HeaderSchema)({
          protocol: "typh",
          version: 1,
          id,
          action: "client:mutate",
          payload: {
            handler: handler,
            token: Option.getOrUndefined(token),
          },
        }),
      ),
      Effect.bind("requestHeaderEncoded", ({ requestHeader }) =>
        Msgpack.Encoder.encode(requestHeader),
      ),
      Effect.bind("dataEncoded", () => Msgpack.Encoder.encode(data)),
      Effect.let("requestBuffer", ({ requestHeaderEncoded, dataEncoded }) => {
        const requestBuffer = new Uint8Array(
          requestHeaderEncoded.length + dataEncoded.length,
        );
        requestBuffer.set(requestHeaderEncoded, 0);
        requestBuffer.set(dataEncoded, requestHeaderEncoded.length);
        return requestBuffer;
      }),
      Effect.bind("ws", () => client.ws),
      Effect.tap(({ ws, requestBuffer }) =>
        Option.map(ws, (ws) => ws.send(requestBuffer)),
      ),
      Effect.flatMap(({ deferred }) => Deferred.await(deferred)),
      Effect.withSpan("WebSocketClient.mutate", {
        attributes: {
          handler,
        },
        captureStackTrace: true,
      }),
    );
  }
}
