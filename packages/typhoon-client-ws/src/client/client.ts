import { StandardSchemaV1 } from "@standard-schema/spec";
import {
  Data,
  Deferred,
  Effect,
  HashMap,
  Match,
  Option,
  pipe,
  SynchronizedRef,
} from "effect";
import { RequestParamsConfig } from "typhoon-core/config";
import {
  Header,
  HeaderEncoderDecoder,
  MsgpackEncoderDecoder,
} from "typhoon-core/protocol";
import { validate } from "typhoon-core/schema";
import {
  MutationHandlerContext,
  Server,
  ServerMutationHandlers,
  ServerSubscriptionHandlers,
  SubscriptionHandlerContext,
} from "typhoon-core/server";
import { DependencySignal, signal } from "typhoon-core/signal";
import * as v from "valibot";

const WebSocketCtor = globalThis.WebSocket;

export class HandlerError extends Data.TaggedError("HandlerError") {}

type LoadingState = {
  isLoading: true;
};

type ResolvedState<T = unknown> = {
  isLoading: false;
  nonce: number;
  value: Effect.Effect<T, HandlerError, never>;
};

type SignalState<T = unknown> = LoadingState | ResolvedState<T>;

type UpdaterState<T = unknown> = {
  updater: (value: ResolvedState<T>) => Effect.Effect<void, never, never>;
};
type UpdaterStateMap = HashMap.HashMap<string, UpdaterState>;

export class WebSocketClient<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  SubscriptionHandlers extends Record<
    string,
    SubscriptionHandlerContext
  > = Record<string, SubscriptionHandlerContext>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  MutationHandlers extends Record<string, MutationHandlerContext> = Record<
    string,
    MutationHandlerContext
  >,
> {
  constructor(
    private readonly url: string,
    private readonly ws: SynchronizedRef.SynchronizedRef<
      Option.Option<WebSocket>
    >,
    private readonly updaterStateMapRef: SynchronizedRef.SynchronizedRef<UpdaterStateMap>,
  ) {}

  static create<
    S extends Server<
      Record<string, SubscriptionHandlerContext>,
      Record<string, MutationHandlerContext>
    >,
  >(
    url: string,
  ): Effect.Effect<
    WebSocketClient<ServerSubscriptionHandlers<S>, ServerMutationHandlers<S>>,
    never,
    never
  > {
    return pipe(
      Effect.Do,
      Effect.bind("ws", () => SynchronizedRef.make(Option.none<WebSocket>())),
      Effect.bind("updaterStateMapRef", () =>
        SynchronizedRef.make(HashMap.empty<string, UpdaterState>()),
      ),
      Effect.map(
        ({ ws, updaterStateMapRef }) =>
          new WebSocketClient<
            ServerSubscriptionHandlers<S>,
            ServerMutationHandlers<S>
          >(url, ws, updaterStateMapRef),
      ),
      Effect.withSpan("WebSocketClient.create"),
    );
  }

  static handleUpdate(header: Header, decodedResponse: unknown) {
    return (
      client: WebSocketClient<
        Record<string, SubscriptionHandlerContext>,
        Record<string, MutationHandlerContext>
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
                    updater({
                      isLoading: false,
                      nonce: header.payload.nonce,
                      value: header.payload.success
                        ? Effect.succeed(decodedResponse)
                        : Effect.fail(
                            new HandlerError(decodedResponse as void),
                          ),
                    }),
                  ),
                  Match.orElse(() => Effect.void),
                ),
              onNone: () => Effect.void,
            }),
          ),
        ),
      );
  }

  static connect(
    client: WebSocketClient<
      Record<string, SubscriptionHandlerContext>,
      Record<string, MutationHandlerContext>
    >,
  ) {
    return pipe(
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
  }

  static close(
    client: WebSocketClient<
      Record<string, SubscriptionHandlerContext>,
      Record<string, MutationHandlerContext>
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

  static subscribe<
    ServerSubscriptionHandlers extends Record<
      string,
      SubscriptionHandlerContext
    >,
    Handler extends keyof ServerSubscriptionHandlers & string,
  >(
    client: WebSocketClient<
      ServerSubscriptionHandlers,
      Record<string, MutationHandlerContext>
    >,
    handler: Handler,
    // TODO: make this conditionally optional
    data?: ServerSubscriptionHandlers[Handler]["config"]["requestParams"] extends infer HandlerRequestParamsConfig extends
      RequestParamsConfig
      ? StandardSchemaV1.InferInput<HandlerRequestParamsConfig["validator"]>
      : never,
  ) {
    return pipe(
      Effect.Do,
      Effect.let("id", () => crypto.randomUUID() as string),
      Effect.let("signal", () => signal<SignalState>({ isLoading: true })),
      Effect.let(
        "updater",
        ({ signal }) =>
          (value: ResolvedState<unknown>) =>
            signal.updateValue((prev) =>
              Effect.succeed(
                prev.isLoading || prev.nonce < value.nonce
                  ? {
                      isLoading: false,
                      nonce: value.nonce,
                      value: value.value,
                    }
                  : prev,
              ),
            ),
      ),
      Effect.tap(({ id, updater }) =>
        pipe(
          client.updaterStateMapRef,
          SynchronizedRef.update(HashMap.set(id, { updater })),
        ),
      ),
      Effect.bind("requestHeader", ({ id }) =>
        HeaderEncoderDecoder.encode({
          protocol: "typh",
          version: 1,
          id,
          action: "client:subscribe",
          payload: {
            handler: handler,
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
                  ServerSubscriptionHandlers[Handler]["config"]["response"]["validator"]
                >
              >,
              never,
              never
            >,
            WebSocketClient.unsubscribe(client, id, handler),
          ] as const,
      ),
      Effect.withSpan("WebSocketClient.subscribe"),
    );
  }

  static unsubscribe<
    ServerSubscriptionHandlers extends Record<
      string,
      SubscriptionHandlerContext
    >,
    Handler extends keyof ServerSubscriptionHandlers & string,
  >(
    client: WebSocketClient<
      ServerSubscriptionHandlers,
      Record<string, MutationHandlerContext>
    >,
    id: string,
    handler: Handler,
  ) {
    return pipe(
      Effect.Do,
      Effect.tap(() =>
        pipe(
          client.updaterStateMapRef,
          SynchronizedRef.update(HashMap.modifyAt(id, () => Option.none())),
        ),
      ),
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
      Effect.withSpan("WebSocketClient.unsubscribe"),
    );
  }

  static once<
    ServerSubscriptionHandlers extends Record<
      string,
      SubscriptionHandlerContext
    >,
    Handler extends keyof ServerSubscriptionHandlers & string,
  >(
    client: WebSocketClient<
      ServerSubscriptionHandlers,
      Record<string, MutationHandlerContext>
    >,
    handler: Handler,
    // TODO: make this conditionally optional
    data?: ServerSubscriptionHandlers[Handler]["config"]["requestParams"] extends infer HandlerRequestParamsConfig extends
      RequestParamsConfig
      ? StandardSchemaV1.InferInput<HandlerRequestParamsConfig["validator"]>
      : never,
  ) {
    return pipe(
      Effect.Do,
      Effect.let("id", () => crypto.randomUUID() as string),
      Effect.bind("deferred", () => Deferred.make<unknown, HandlerError>()),
      Effect.let(
        "updater",
        ({ id, deferred }) =>
          (value: ResolvedState<unknown>) =>
            pipe(
              deferred,
              Deferred.complete(value.value),
              Effect.andThen(() =>
                pipe(
                  client.updaterStateMapRef,
                  SynchronizedRef.update(
                    HashMap.modifyAt(id, () => Option.none()),
                  ),
                ),
              ),
              Effect.asVoid,
            ),
      ),
      Effect.tap(({ id, updater }) =>
        pipe(
          client.updaterStateMapRef,
          SynchronizedRef.update(HashMap.set(id, { updater })),
        ),
      ),
      Effect.bind("requestHeader", ({ id }) =>
        HeaderEncoderDecoder.encode({
          protocol: "typh",
          version: 1,
          id,
          action: "client:once",
          payload: {
            handler: handler,
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
              ServerSubscriptionHandlers[Handler]["config"]["response"]["validator"]
            >,
            HandlerError
          >,
        ),
      ),
      Effect.withSpan("WebSocketClient.once"),
    );
  }
}
