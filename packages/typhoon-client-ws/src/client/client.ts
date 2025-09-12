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
  SynchronizedRef,
} from "effect";
import {
  HandlerConfigGroup,
  MutationHandlerConfig,
  RequestParamsConfig,
  SubscriptionHandlerConfig,
} from "typhoon-core/config";
import {
  Header,
  HeaderEncoderDecoder,
  MsgpackEncoderDecoder,
} from "typhoon-core/protocol";
import { validate } from "typhoon-core/schema";
import { DependencySignal, signal } from "typhoon-core/signal";
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
    SubscriptionHandlerConfig
  > = Record<string, SubscriptionHandlerConfig>,
  MutationHandlerConfigs extends Record<string, MutationHandlerConfig> = Record<
    string,
    MutationHandlerConfig
  >,
> {
  constructor(
    private readonly url: string,
    private readonly ws: SynchronizedRef.SynchronizedRef<
      Option.Option<WebSocket>
    >,
    private readonly updaterStateMapRef: SynchronizedRef.SynchronizedRef<UpdaterStateMap>,
    private readonly configGroup: HandlerConfigGroup<
      SubscriptionHandlerConfigs,
      MutationHandlerConfigs
    >,
    private readonly token: SynchronizedRef.SynchronizedRef<
      Option.Option<string>
    >,
  ) {}

  static create<
    SubscriptionHandlerConfigs extends Record<
      string,
      SubscriptionHandlerConfig
    >,
    MutationHandlerConfigs extends Record<string, MutationHandlerConfig>,
  >(
    configGroup: HandlerConfigGroup<
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
      Effect.map(
        ({ ws, updaterStateMapRef, token }) =>
          new WebSocketClient<
            SubscriptionHandlerConfigs,
            MutationHandlerConfigs
          >(url, ws, updaterStateMapRef, configGroup, token),
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
        Record<string, SubscriptionHandlerConfig>,
        Record<string, MutationHandlerConfig>
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
        Record<string, SubscriptionHandlerConfig>,
        Record<string, MutationHandlerConfig>
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
        Record<string, SubscriptionHandlerConfig>,
        Record<string, MutationHandlerConfig>
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
      Record<string, SubscriptionHandlerConfig>,
      Record<string, MutationHandlerConfig>
    >,
  ) =>
    pipe(
      Effect.Do,
      Effect.bind("latch", () => Effect.makeLatch()),
      Effect.tap(({ latch }) =>
        pipe(
          client.ws,
          SynchronizedRef.updateEffect(() => {
            const ws = new WebSocketCtor(client.url);
            ws.binaryType = "blob";
            ws.onmessage = (event) =>
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
              );
            ws.onopen = () => Effect.runPromise(latch.open);
            return pipe(Effect.succeed(Option.some(ws)), latch.whenOpen);
          }),
        ),
      ),
      Effect.withSpan("WebSocketClient.connect"),
    );

  static close(
    client: WebSocketClient<
      Record<string, SubscriptionHandlerConfig>,
      Record<string, MutationHandlerConfig>
    >,
  ) {
    return pipe(
      client.ws,
      SynchronizedRef.update((ws) =>
        Option.flatMap(ws, (ws) => {
          ws.close();
          return Option.none();
        }),
      ),
      Effect.withSpan("WebSocketClient.close"),
    );
  }

  static token =
    (token: Option.Option<string>) =>
    (
      client: WebSocketClient<
        Record<string, SubscriptionHandlerConfig>,
        Record<string, MutationHandlerConfig>
      >,
    ) =>
      pipe(
        SynchronizedRef.update(client.token, () => token),
        Effect.withSpan("WebSocketClient.token"),
      );

  static subscribe<
    SubscriptionHandlerConfigs extends Record<
      string,
      SubscriptionHandlerConfig
    >,
    Handler extends keyof SubscriptionHandlerConfigs & string,
  >(
    client: WebSocketClient<
      SubscriptionHandlerConfigs,
      Record<string, MutationHandlerConfig>
    >,
    handler: Handler,
    // TODO: make this conditionally optional
    data?: SubscriptionHandlerConfigs[Handler]["requestParams"] extends infer HandlerRequestParamsConfig extends
      RequestParamsConfig
      ? StandardSchemaV1.InferInput<HandlerRequestParamsConfig["validator"]>
      : never,
  ) {
    return pipe(
      Effect.Do,
      Effect.let("id", () => crypto.randomUUID() as string),
      Effect.let("signal", () => signal<SignalState>({ state: "loading" })),
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
                      // TODO: validate the response validator
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
                          validate(config.response.validator)(value),
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
            signal as DependencySignal<
              SignalState<
                StandardSchemaV1.InferOutput<
                  SubscriptionHandlerConfigs[Handler]["response"]["validator"]
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
      SubscriptionHandlerConfig
    >,
    Handler extends keyof SubscriptionHandlerConfigs & string,
  >(
    client: WebSocketClient<
      SubscriptionHandlerConfigs,
      Record<string, MutationHandlerConfig>
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
      SubscriptionHandlerConfig
    >,
    Handler extends keyof SubscriptionHandlerConfigs & string,
  >(
    client: WebSocketClient<
      SubscriptionHandlerConfigs,
      Record<string, MutationHandlerConfig>
    >,
    handler: Handler,
    // TODO: make this conditionally optional
    data?: SubscriptionHandlerConfigs[Handler]["requestParams"] extends infer HandlerRequestParamsConfig extends
      RequestParamsConfig
      ? StandardSchemaV1.InferInput<HandlerRequestParamsConfig["validator"]>
      : never,
  ) {
    return pipe(
      Effect.Do,
      Effect.let("id", () => crypto.randomUUID() as string),
      Effect.bind("deferred", () => Deferred.make<unknown, HandlerError>()),
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
                    validate(config.response.validator)(value),
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
      Effect.flatMap(({ deferred }) =>
        Deferred.await(
          deferred as Deferred.Deferred<
            StandardSchemaV1.InferOutput<
              SubscriptionHandlerConfigs[Handler]["response"]["validator"]
            >,
            HandlerError
          >,
        ),
      ),
      Effect.withSpan("WebSocketClient.once", {
        attributes: {
          handler,
        },
        captureStackTrace: true,
      }),
    );
  }

  static mutate<
    MutationHandlerConfigs extends Record<string, MutationHandlerConfig>,
    Handler extends keyof MutationHandlerConfigs & string,
  >(
    client: WebSocketClient<
      Record<string, SubscriptionHandlerConfig>,
      MutationHandlerConfigs
    >,
    handler: Handler,
    // TODO: make this conditionally optional
    data?: MutationHandlerConfigs[Handler]["requestParams"] extends infer HandlerRequestParamsConfig extends
      RequestParamsConfig
      ? StandardSchemaV1.InferInput<HandlerRequestParamsConfig["validator"]>
      : never,
  ) {
    return pipe(
      Effect.Do,
      Effect.let("id", () => crypto.randomUUID() as string),
      Effect.bind("deferred", () => Deferred.make<unknown, HandlerError>()),
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
                    validate(config.response.validator)(value),
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
      Effect.flatMap(({ deferred }) =>
        Deferred.await(
          deferred as Deferred.Deferred<
            StandardSchemaV1.InferOutput<
              MutationHandlerConfigs[Handler]["response"]["validator"]
            >,
            HandlerError
          >,
        ),
      ),
      Effect.withSpan("WebSocketClient.mutate", {
        attributes: {
          handler,
        },
        captureStackTrace: true,
      }),
    );
  }
}
