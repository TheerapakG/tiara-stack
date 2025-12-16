import {
  Data,
  DateTime,
  Deferred,
  Effect,
  Either,
  HashMap,
  Match,
  Option,
  Order,
  pipe,
  Runtime,
  Schedule,
  Schema,
  String,
  SynchronizedRef,
  Tracer,
  Function,
  flow,
} from "effect";
import {
  MissingRpcConfigError,
  RpcError,
  ValidationError,
} from "typhoon-core/error";
import { Handler } from "typhoon-core/server";
import { Header, Msgpack, Stream } from "typhoon-core/protocol";
import {
  DependencySignal,
  Signal,
  Computed,
  SignalService,
} from "typhoon-core/signal";
import { Validator } from "typhoon-core/validator";
import { RpcResult } from "typhoon-core/schema";

const WebSocketCtor = globalThis.WebSocket;

class WebSocketError extends Data.TaggedError("WebSocketError")<{
  cause: Event;
}> {}

type UpdaterState = {
  updater: (
    header: Header.Header<"server:update">,
    result: Either.Either<unknown, unknown>,
  ) => Effect.Effect<void, never, SignalService.SignalService>;
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
    const Collection extends Handler.Config.Collection.HandlerConfigCollection<
      any,
      any
    >,
  >(
    configCollection: Collection,
    url: string,
  ): Effect.Effect<
    WebSocketClient<
      Handler.Config.Collection.HandlerConfigCollectionSubscriptionHandlerConfigs<Collection>,
      Handler.Config.Collection.HandlerConfigCollectionMutationHandlerConfigs<Collection>
    >,
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
            Handler.Config.Collection.HandlerConfigCollectionSubscriptionHandlerConfigs<Collection>,
            Handler.Config.Collection.HandlerConfigCollectionMutationHandlerConfigs<Collection>
          >(url, ws, updaterStateMapRef, configCollection, token, status),
      ),
      Effect.withSpan("WebSocketClient.create", {
        captureStackTrace: true,
      }),
    );
  }

  static addUpdater(
    id: string,
    updater: (
      header: Header.Header<"server:update">,
      result: Either.Either<unknown, unknown>,
    ) => Effect.Effect<void, never, SignalService.SignalService>,
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
        Effect.flatMap(
          Effect.transposeMapOption(({ updater }) =>
            pipe(
              Match.value(header),
              Match.when({ action: "server:update" }, (header) =>
                updater(
                  header,
                  pipe(
                    decodedResponse,
                    Either.liftPredicate(
                      () => header.payload.success,
                      Function.identity,
                    ),
                  ),
                ),
              ),
              Match.orElse(() => Effect.void),
            ),
          ),
        ),
      );
  }

  static connectOnce = (
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
      Effect.tap(() => Effect.log("connecting to websocket")),
      Effect.bind("deferred", () =>
        Deferred.make<Option.Option<WebSocket>, WebSocketError>(),
      ),
      Effect.bind("runtime", () =>
        Effect.runtime<SignalService.SignalService>(),
      ),
      Effect.tap(({ deferred, runtime }) =>
        pipe(
          client.ws,
          SynchronizedRef.updateEffect(() => {
            const ws = new WebSocketCtor(client.url);
            ws.binaryType = "blob";
            ws.addEventListener("message", (event) =>
              pipe(
                Effect.Do,
                Effect.let("data", () => event.data as Blob),
                Effect.bind("pullEffect", ({ data }) =>
                  pipe(Msgpack.Decoder.blobToStream(data), Stream.toPullEffect),
                ),
                Effect.bind("header", ({ pullEffect }) =>
                  pipe(
                    pullEffect,
                    Effect.flatMap(Schema.decodeUnknown(Header.HeaderSchema)),
                  ),
                ),
                Effect.tap(({ header, pullEffect }) =>
                  pipe(
                    Match.value(header),
                    Match.when({ action: "server:update" }, (header) =>
                      pipe(
                        pullEffect,
                        Effect.andThen((decodedResponse) =>
                          WebSocketClient.handleUpdate(
                            header,
                            decodedResponse,
                          )(client),
                        ),
                      ),
                    ),
                    Match.orElse(() => Effect.void),
                  ),
                ),
                Effect.asVoid,
                Effect.scoped,
                Runtime.runPromise(runtime),
              ),
            );
            ws.addEventListener("open", () =>
              pipe(
                Effect.log("websocket opened"),
                Effect.andThen(() =>
                  pipe(deferred, Deferred.succeed(Option.some(ws))),
                ),
                Runtime.runPromise(runtime),
              ),
            );
            ws.addEventListener("error", (errorEvent) =>
              pipe(
                Effect.log("websocket errored"),
                Effect.andThen(() =>
                  pipe(
                    WebSocketClient.connect(client),
                    Effect.unlessEffect(
                      pipe(
                        deferred,
                        Deferred.fail(
                          new WebSocketError({ cause: errorEvent }),
                        ),
                      ),
                    ),
                  ),
                ),
                Runtime.runPromise(runtime),
              ),
            );
            ws.addEventListener("close", (closeEvent) =>
              pipe(
                Effect.log("websocket closed"),
                Effect.andThen(() =>
                  pipe(
                    WebSocketClient.connect(client),
                    Effect.unlessEffect(
                      pipe(
                        pipe(
                          deferred,
                          Deferred.fail(
                            new WebSocketError({ cause: closeEvent }),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                Runtime.runPromise(runtime),
              ),
            );
            return Deferred.await(deferred);
          }),
        ),
      ),
      Effect.tap(() =>
        SynchronizedRef.update(client.status, () => "connected" as const),
      ),
      Effect.withSpan("WebSocketClient.connect", {
        captureStackTrace: true,
      }),
    );

  static connect(
    client: WebSocketClient<
      Record<string, Handler.Config.Subscription.SubscriptionHandlerConfig>,
      Record<string, Handler.Config.Mutation.MutationHandlerConfig>
    >,
  ) {
    return pipe(
      WebSocketClient.connectOnce(client),
      Effect.unlessEffect(
        pipe(
          SynchronizedRef.get(client.status),
          Effect.map((status) => String.Equivalence(status, "disconnecting")),
        ),
      ),
      Effect.retry(Schedule.exponential(1000)),
      Effect.withSpan("WebSocketClient.retryConnect", {
        captureStackTrace: true,
      }),
    );
  }

  static close(
    client: WebSocketClient<
      Record<string, Handler.Config.Subscription.SubscriptionHandlerConfig>,
      Record<string, Handler.Config.Mutation.MutationHandlerConfig>
    >,
  ) {
    return pipe(
      SynchronizedRef.update(client.status, () => "disconnecting" as const),
      Effect.tap(() => Effect.log("disconnecting from websocket")),
      Effect.andThen(
        SynchronizedRef.updateEffect(
          client.ws,
          flow(
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
      Effect.withSpan("WebSocketClient.close", {
        captureStackTrace: true,
      }),
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
        Effect.withSpan("WebSocketClient.token", {
          captureStackTrace: true,
        }),
      );

  static subscribe<
    SubscriptionHandlerConfigs extends Record<
      string,
      Handler.Config.Subscription.SubscriptionHandlerConfig
    >,
    H extends keyof SubscriptionHandlerConfigs & string,
  >(
    client: WebSocketClient<
      SubscriptionHandlerConfigs,
      Record<string, Handler.Config.Mutation.MutationHandlerConfig>
    >,
    handler: H,
    // TODO: make this conditionally optional
    data?: Validator.Input<
      Handler.Config.ResolvedRequestParamsValidator<
        Handler.Config.RequestParamsOrUndefined<SubscriptionHandlerConfigs[H]>
      >
    >,
  ) {
    return pipe(
      Effect.Do,
      Effect.let("config", () =>
        pipe(
          Handler.Config.Collection.getHandlerConfig(
            "subscription",
            handler,
          )(client.configCollection),
          Option.getOrThrowWith(() =>
            MissingRpcConfigError.make({
              message: `Failed to get handler config for ${handler}`,
            }),
          ),
        ),
      ),
      Effect.let("responseErrorValidator", ({ config }) =>
        Handler.Config.resolveResponseErrorValidator(
          Handler.Config.responseError(config),
        ),
      ),
      Effect.let("id", () => crypto.randomUUID() as string),
      Effect.let("signal", () =>
        Signal.make<
          RpcResult.RpcResult<
            Validator.Output<
              Handler.Config.ResolvedResponseValidator<
                Handler.Config.ResponseOrUndefined<
                  SubscriptionHandlerConfigs[H]
                >
              >
            >,
            Validator.Output<
              Handler.Config.ResolvedResponseErrorValidator<
                Handler.Config.ResponseErrorOrUndefined<
                  SubscriptionHandlerConfigs[H]
                >
              >
            >
          >
        >(RpcResult.loading()),
      ),
      Effect.tap(({ id, signal, config }) =>
        pipe(
          client,
          WebSocketClient.addUpdater(id, (header, result) =>
            signal.updateValue((prev) =>
              prev._tag === "Loading" ||
              Order.lessThan(Option.getOrder(DateTime.Order))(
                prev.timestamp,
                DateTime.make(header.payload.timestamp),
              )
                ? pipe(
                    result,
                    Handler.Config.decodeResponseUnknown(config),
                    Effect.map(
                      Either.mapLeft(
                        (error) =>
                          new RpcError({
                            message:
                              typeof error === "object" &&
                              error !== null &&
                              "message" in error &&
                              typeof error.message === "string"
                                ? error.message
                                : "An unknown error occurred",
                            cause: error,
                          }),
                      ),
                    ),
                    Effect.flatten,
                    Effect.either,
                    Effect.map((value) =>
                      RpcResult.resolved(
                        DateTime.make(header.payload.timestamp),
                        value,
                      ),
                    ),
                  )
                : Effect.succeed(prev),
            ),
          ),
        ),
      ),
      Effect.bind("token", () => client.token),
      Effect.bind("span", () =>
        pipe(
          Effect.currentSpan,
          Effect.match({
            onSuccess: Option.some,
            onFailure: () => Option.none<Tracer.Span>(),
          }),
        ),
      ),
      Effect.bind("requestHeader", ({ id, token, span }) =>
        Schema.encode(Header.HeaderSchema)({
          protocol: "typh",
          version: 1,
          id,
          action: "client:subscribe",
          payload: {
            handler: handler,
            token: Option.getOrUndefined(token),
          },
          span: pipe(
            span,
            Option.map((span) => ({
              traceId: span.traceId,
              spanId: span.spanId,
            })),
            Option.getOrUndefined,
          ),
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
      Effect.bind("maskedSignal", ({ signal }) =>
        Computed.make(
          pipe(
            signal,
            Effect.tap((value) =>
              pipe(
                Match.value(value),
                Match.tagsExhaustive({
                  Loading: () => Effect.void,
                  Resolved: (value) =>
                    value.span
                      ? Effect.linkSpanCurrent(Tracer.externalSpan(value.span))
                      : Effect.void,
                }),
              ),
            ),
          ),
        ),
      ),
      Effect.map(
        ({ id, maskedSignal }) =>
          ({
            requestId: id,
            signal: pipe(maskedSignal, DependencySignal.mask),
          }) as const,
      ),
      Effect.withSpan("WebSocketClient.subscribe", {
        attributes: {
          handler,
        },
        captureStackTrace: true,
      }),
    );
  }

  static subscribeScoped<
    SubscriptionHandlerConfigs extends Record<
      string,
      Handler.Config.Subscription.SubscriptionHandlerConfig
    >,
    H extends keyof SubscriptionHandlerConfigs & string,
  >(
    client: WebSocketClient<
      SubscriptionHandlerConfigs,
      Record<string, Handler.Config.Mutation.MutationHandlerConfig>
    >,
    handler: H,
    // TODO: make this conditionally optional
    data?: Validator.Input<
      Handler.Config.ResolvedRequestParamsValidator<
        Handler.Config.RequestParamsOrUndefined<SubscriptionHandlerConfigs[H]>
      >
    >,
  ) {
    return pipe(
      Effect.acquireRelease(
        WebSocketClient.subscribe(client, handler, data),
        ({ requestId }) =>
          pipe(
            WebSocketClient.unsubscribe(client, requestId, handler),
            Effect.catchAll(() => Effect.void),
          ),
      ),
      Effect.map(({ signal }) => signal),
      Effect.withSpan("WebSocketClient.subscribeScoped", {
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
    H extends keyof SubscriptionHandlerConfigs & string,
  >(
    client: WebSocketClient<
      SubscriptionHandlerConfigs,
      Record<string, Handler.Config.Mutation.MutationHandlerConfig>
    >,
    id: string,
    handler: H,
  ) {
    return pipe(
      Effect.Do,
      Effect.tap(() => pipe(client, WebSocketClient.removeUpdater(id))),
      Effect.bind("span", () =>
        pipe(
          Effect.currentSpan,
          Effect.match({
            onSuccess: Option.some,
            onFailure: () => Option.none<Tracer.Span>(),
          }),
        ),
      ),
      Effect.bind("header", ({ span }) =>
        Schema.encode(Header.HeaderSchema)({
          protocol: "typh",
          version: 1,
          id,
          action: "client:unsubscribe",
          payload: {},
          span: pipe(
            span,
            Option.map((span) => ({
              traceId: span.traceId,
              spanId: span.spanId,
            })),
            Option.getOrUndefined,
          ),
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
    H extends keyof SubscriptionHandlerConfigs & string,
  >(
    client: WebSocketClient<
      SubscriptionHandlerConfigs,
      Record<string, Handler.Config.Mutation.MutationHandlerConfig>
    >,
    handler: H,
    // TODO: make this conditionally optional
    data?: Validator.Input<
      Handler.Config.ResolvedRequestParamsValidator<
        Handler.Config.RequestParamsOrUndefined<SubscriptionHandlerConfigs[H]>
      >
    >,
  ) {
    return pipe(
      Effect.Do,
      Effect.let("config", () =>
        pipe(
          Handler.Config.Collection.getHandlerConfig(
            "subscription",
            handler,
          )(client.configCollection),
          Option.getOrThrowWith(() =>
            MissingRpcConfigError.make({
              message: `Failed to get handler config for ${handler}`,
            }),
          ),
        ),
      ),
      Effect.let("responseErrorValidator", ({ config }) =>
        Handler.Config.resolveResponseErrorValidator(
          Handler.Config.responseError(config),
        ),
      ),
      Effect.let("id", () => crypto.randomUUID() as string),
      Effect.bind("deferred", () =>
        Deferred.make<
          {
            result: Either.Either<
              Validator.Output<
                Handler.Config.ResolvedResponseValidator<
                  Handler.Config.ResponseOrUndefined<
                    SubscriptionHandlerConfigs[H]
                  >
                >
              >,
              | RpcError<
                  Validator.Output<
                    Handler.Config.ResolvedResponseErrorValidator<
                      Handler.Config.ResponseErrorOrUndefined<
                        SubscriptionHandlerConfigs[H]
                      >
                    >
                  >
                >
              | ValidationError
            >;
            span: { traceId: string; spanId: string } | undefined;
          },
          never
        >(),
      ),
      Effect.tap(({ id, deferred, config }) =>
        pipe(
          client,
          WebSocketClient.addUpdater(id, (header, result) =>
            pipe(
              deferred,
              Deferred.complete(
                pipe(
                  result,
                  Handler.Config.decodeResponseUnknown(config),
                  Effect.map(
                    Either.mapLeft(
                      (error) =>
                        new RpcError({
                          message:
                            typeof error === "object" &&
                            error !== null &&
                            "message" in error &&
                            typeof error.message === "string"
                              ? error.message
                              : "An unknown error occurred",
                          cause: error,
                        }),
                    ),
                  ),
                  Effect.flatten,
                  Effect.either,
                  Effect.map((result) => ({ result, span: header.span })),
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
      Effect.bind("span", () =>
        pipe(
          Effect.currentSpan,
          Effect.match({
            onSuccess: Option.some,
            onFailure: () => Option.none<Tracer.Span>(),
          }),
        ),
      ),
      Effect.bind("requestHeader", ({ id, token, span }) =>
        Schema.encode(Header.HeaderSchema)({
          protocol: "typh",
          version: 1,
          id,
          action: "client:once",
          payload: {
            handler: handler,
            token: Option.getOrUndefined(token),
          },
          span: pipe(
            span,
            Option.map((span) => ({
              traceId: span.traceId,
              spanId: span.spanId,
            })),
            Option.getOrUndefined,
          ),
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
      Effect.tap(({ span }) =>
        span ? Effect.linkSpanCurrent(Tracer.externalSpan(span)) : Effect.void,
      ),
      Effect.flatMap(({ result }) => result),
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
    H extends keyof MutationHandlerConfigs & string,
  >(
    client: WebSocketClient<
      Record<string, Handler.Config.Subscription.SubscriptionHandlerConfig>,
      MutationHandlerConfigs
    >,
    handler: H,
    // TODO: make this conditionally optional
    data?: Validator.Input<
      Handler.Config.ResolvedRequestParamsValidator<
        Handler.Config.RequestParamsOrUndefined<MutationHandlerConfigs[H]>
      >
    >,
  ) {
    return pipe(
      Effect.Do,
      Effect.let("config", () =>
        pipe(
          Handler.Config.Collection.getHandlerConfig(
            "mutation",
            handler,
          )(client.configCollection),
          Option.getOrThrowWith(() =>
            MissingRpcConfigError.make({
              message: `Failed to get handler config for ${handler}`,
            }),
          ),
        ),
      ),
      Effect.let("responseErrorValidator", ({ config }) =>
        Handler.Config.resolveResponseErrorValidator(
          Handler.Config.responseError(config),
        ),
      ),
      Effect.let("id", () => crypto.randomUUID() as string),
      Effect.bind("deferred", () =>
        Deferred.make<
          {
            result: Either.Either<
              Validator.Output<
                Handler.Config.ResolvedResponseValidator<
                  Handler.Config.ResponseOrUndefined<MutationHandlerConfigs[H]>
                >
              >,
              | RpcError<
                  Validator.Output<
                    Handler.Config.ResolvedResponseErrorValidator<
                      Handler.Config.ResponseErrorOrUndefined<
                        MutationHandlerConfigs[H]
                      >
                    >
                  >
                >
              | ValidationError
            >;
            span: { traceId: string; spanId: string } | undefined;
          },
          never
        >(),
      ),
      Effect.tap(({ id, deferred, config }) =>
        pipe(
          client,
          WebSocketClient.addUpdater(id, (header, result) =>
            pipe(
              deferred,
              Deferred.complete(
                pipe(
                  result,
                  Handler.Config.decodeResponseUnknown(config),
                  Effect.map(
                    Either.mapLeft(
                      (error) =>
                        new RpcError({
                          message:
                            typeof error === "object" &&
                            error !== null &&
                            "message" in error &&
                            typeof error.message === "string"
                              ? error.message
                              : "An unknown error occurred",
                          cause: error,
                        }),
                    ),
                  ),
                  Effect.flatten,
                  Effect.either,
                  Effect.map((result) => ({ result, span: header.span })),
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
      Effect.bind("span", () =>
        pipe(
          Effect.currentSpan,
          Effect.match({
            onSuccess: Option.some,
            onFailure: () => Option.none<Tracer.Span>(),
          }),
        ),
      ),
      Effect.bind("requestHeader", ({ id, token, span }) =>
        Schema.encode(Header.HeaderSchema)({
          protocol: "typh",
          version: 1,
          id,
          action: "client:mutate",
          payload: {
            handler: handler,
            token: Option.getOrUndefined(token),
          },
          span: pipe(
            span,
            Option.map((span) => ({
              traceId: span.traceId,
              spanId: span.spanId,
            })),
            Option.getOrUndefined,
          ),
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
      Effect.tap(({ span }) =>
        span ? Effect.linkSpanCurrent(Tracer.externalSpan(span)) : Effect.void,
      ),
      Effect.flatMap(({ result }) => result),
      Effect.withSpan("WebSocketClient.mutate", {
        attributes: {
          handler,
        },
        captureStackTrace: true,
      }),
    );
  }
}
