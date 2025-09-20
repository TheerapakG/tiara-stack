import { StandardSchemaV1 } from "@standard-schema/spec";
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
  String,
  SynchronizedRef,
} from "effect";
import { HandlerConfig } from "typhoon-core/config";
import {
  Header,
  HeaderEncoderDecoder,
  MsgpackEncoderDecoder,
} from "typhoon-core/protocol";
import { DependencySignal, Signal } from "typhoon-core/signal";
import { validate, Validator } from "typhoon-core/validator";
import * as v from "valibot";

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
    HandlerConfig.SubscriptionHandlerConfig
  > = Record<string, HandlerConfig.SubscriptionHandlerConfig>,
  MutationHandlerConfigs extends Record<
    string,
    HandlerConfig.MutationHandlerConfig
  > = Record<string, HandlerConfig.MutationHandlerConfig>,
> {
  constructor(
    private readonly url: string,
    private readonly ws: SynchronizedRef.SynchronizedRef<
      Option.Option<WebSocket>
    >,
    private readonly updaterStateMapRef: SynchronizedRef.SynchronizedRef<UpdaterStateMap>,
    private readonly configGroup: HandlerConfig.Group.HandlerConfigGroup<
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
      HandlerConfig.SubscriptionHandlerConfig
    >,
    MutationHandlerConfigs extends Record<
      string,
      HandlerConfig.MutationHandlerConfig
    >,
  >(
    configGroup: HandlerConfig.Group.HandlerConfigGroup<
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
          >(url, ws, updaterStateMapRef, configGroup, token, status),
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
    return (
      client: WebSocketClient<
        Record<string, HandlerConfig.SubscriptionHandlerConfig>,
        Record<string, HandlerConfig.MutationHandlerConfig>
      >,
    ) =>
      pipe(
        client.updaterStateMapRef,
        SynchronizedRef.update(HashMap.set(id, { updater })),
      );
  }

  static removeUpdater(id: string) {
    return (
      client: WebSocketClient<
        Record<string, HandlerConfig.SubscriptionHandlerConfig>,
        Record<string, HandlerConfig.MutationHandlerConfig>
      >,
    ) =>
      pipe(
        client.updaterStateMapRef,
        SynchronizedRef.update(HashMap.remove(id)),
      );
  }

  static handleUpdate(header: Header, decodedResponse: unknown) {
    return (
      client: WebSocketClient<
        Record<string, HandlerConfig.SubscriptionHandlerConfig>,
        Record<string, HandlerConfig.MutationHandlerConfig>
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
      Record<string, HandlerConfig.SubscriptionHandlerConfig>,
      Record<string, HandlerConfig.MutationHandlerConfig>
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
                  Effect.bind("pullDecodedStream", ({ data }) =>
                    MsgpackEncoderDecoder.blobToPullDecodedStream(data),
                  ),
                  Effect.bind("header", ({ pullDecodedStream }) =>
                    pipe(
                      pullDecodedStream,
                      Effect.flatMap(
                        validate(v.array(v.tuple([v.number(), v.unknown()]))),
                      ),
                      Effect.flatMap(HeaderEncoderDecoder.decode),
                    ),
                  ),
                  Effect.bind(
                    "decodedResponse",
                    ({ pullDecodedStream }) => pullDecodedStream,
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
      Record<string, HandlerConfig.SubscriptionHandlerConfig>,
      Record<string, HandlerConfig.MutationHandlerConfig>
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
        Record<string, HandlerConfig.SubscriptionHandlerConfig>,
        Record<string, HandlerConfig.MutationHandlerConfig>
      >,
    ) =>
      pipe(
        SynchronizedRef.update(client.token, () => token),
        Effect.withSpan("WebSocketClient.token"),
      );

  static subscribe<
    SubscriptionHandlerConfigs extends Record<
      string,
      HandlerConfig.SubscriptionHandlerConfig
    >,
    Handler extends keyof SubscriptionHandlerConfigs & string,
  >(
    client: WebSocketClient<
      SubscriptionHandlerConfigs,
      Record<string, HandlerConfig.MutationHandlerConfig>
    >,
    handler: Handler,
    // TODO: make this conditionally optional
    data?: HandlerConfig.ResolvedRequestParamsValidator<
      HandlerConfig.RequestParamsOrUndefined<
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
              HandlerConfig.ResolvedResponseValidator<
                HandlerConfig.ResponseOrUndefined<
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
                          HashMap.get(
                            client.configGroup.subscriptionHandlerMap,
                            handler,
                          ),
                        ),
                        Effect.flatMap(({ value, config }) =>
                          validate(
                            HandlerConfig.resolveResponseValidator(
                              HandlerConfig.response(
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
        HeaderEncoderDecoder.encode({
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
        MsgpackEncoderDecoder.encode(requestHeader),
      ),
      Effect.bind("dataEncoded", () => MsgpackEncoderDecoder.encode(data)),
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
                  HandlerConfig.ResolvedResponseValidator<
                    HandlerConfig.ResponseOrUndefined<
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
      HandlerConfig.SubscriptionHandlerConfig
    >,
    Handler extends keyof SubscriptionHandlerConfigs & string,
  >(
    client: WebSocketClient<
      SubscriptionHandlerConfigs,
      Record<string, HandlerConfig.MutationHandlerConfig>
    >,
    id: string,
    handler: Handler,
  ) {
    return pipe(
      Effect.Do,
      Effect.tap(() => pipe(client, WebSocketClient.removeUpdater(id))),
      Effect.bind("header", () =>
        HeaderEncoderDecoder.encode({
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
        MsgpackEncoderDecoder.encode(header),
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
      HandlerConfig.SubscriptionHandlerConfig
    >,
    Handler extends keyof SubscriptionHandlerConfigs & string,
  >(
    client: WebSocketClient<
      SubscriptionHandlerConfigs,
      Record<string, HandlerConfig.MutationHandlerConfig>
    >,
    handler: Handler,
    // TODO: make this conditionally optional
    data?: HandlerConfig.ResolvedRequestParamsValidator<
      HandlerConfig.RequestParamsOrUndefined<
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
            HandlerConfig.ResolvedResponseValidator<
              HandlerConfig.ResponseOrUndefined<
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
                    HashMap.get(
                      client.configGroup.subscriptionHandlerMap,
                      handler,
                    ),
                  ),
                  Effect.flatMap(({ value, config }) =>
                    validate(
                      HandlerConfig.resolveResponseValidator(
                        HandlerConfig.response(
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
        HeaderEncoderDecoder.encode({
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
        MsgpackEncoderDecoder.encode(requestHeader),
      ),
      Effect.bind("dataEncoded", () => MsgpackEncoderDecoder.encode(data)),
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
      HandlerConfig.MutationHandlerConfig
    >,
    Handler extends keyof MutationHandlerConfigs & string,
  >(
    client: WebSocketClient<
      Record<string, HandlerConfig.SubscriptionHandlerConfig>,
      MutationHandlerConfigs
    >,
    handler: Handler,
    // TODO: make this conditionally optional
    data?: HandlerConfig.ResolvedRequestParamsValidator<
      HandlerConfig.RequestParamsOrUndefined<MutationHandlerConfigs[Handler]>
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
            HandlerConfig.ResolvedResponseValidator<
              HandlerConfig.ResponseOrUndefined<MutationHandlerConfigs[Handler]>
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
                    HashMap.get(client.configGroup.mutationHandlerMap, handler),
                  ),
                  Effect.flatMap(({ value, config }) =>
                    validate(
                      HandlerConfig.resolveResponseValidator(
                        HandlerConfig.response(
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
        HeaderEncoderDecoder.encode({
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
        MsgpackEncoderDecoder.encode(requestHeader),
      ),
      Effect.bind("dataEncoded", () => MsgpackEncoderDecoder.encode(data)),
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
