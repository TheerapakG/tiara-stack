import { StandardSchemaV1 } from "@standard-schema/spec";
import { match, type } from "arktype";
import {
  Chunk,
  Deferred,
  Effect,
  HashMap,
  Option,
  pipe,
  SynchronizedRef,
} from "effect";
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
import { signal, SignalContext } from "typhoon-core/signal";

const WebSocketCtor = globalThis.WebSocket;

type LoadingState = {
  isLoading: true;
};

type SuccessData<T = unknown> = {
  nonce: number;
  value: T;
};

type SuccessState<T = unknown> = {
  isLoading: false;
  data: SuccessData<T>;
};

type SignalState<T = unknown> = LoadingState | SuccessState<T>;

type UpdaterState<T = unknown> = {
  updater: (data: SuccessData<T>) => Effect.Effect<void, never, never>;
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

  static handleUpdate(header: Header<"server:update">, message: unknown) {
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
                updater({
                  nonce: header.payload.nonce,
                  value: message,
                }),
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
                      Effect.flatMap(Chunk.get(0)),
                      Effect.flatMap(
                        validate(type([["number", "unknown"], "[]"])),
                      ),
                      Effect.flatMap(HeaderEncoderDecoder.decode),
                    ),
                  ),
                  Effect.bind("message", ({ pullDecodedStream }) =>
                    pipe(pullDecodedStream, Effect.flatMap(Chunk.get(0))),
                  ),
                  Effect.tap(({ header, message }) =>
                    match
                      .in<Header>()
                      .case({ action: "'server:update'" }, () =>
                        WebSocketClient.handleUpdate(
                          header as Header<"server:update">,
                          message,
                        )(client),
                      )
                      .default(() => Effect.void)(header),
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
  ) {
    return pipe(
      Effect.Do,
      Effect.let("id", () => crypto.randomUUID() as string),
      Effect.let("signal", () => signal<SignalState>({ isLoading: true })),
      Effect.let(
        "updater",
        ({ signal }) =>
          (data: SuccessData) =>
            signal.updateValue((prev) =>
              Effect.succeed(
                prev.isLoading || prev.data.nonce < data.nonce
                  ? {
                      isLoading: false,
                      data: data,
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
      Effect.bind("header", ({ id }) =>
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
      Effect.bind("headerEncoded", ({ header }) =>
        MsgpackEncoderDecoder.encode(header),
      ),
      Effect.bind("ws", () => client.ws),
      Effect.tap(({ ws, headerEncoded }) =>
        Option.map(ws, (ws) => ws.send(headerEncoded)),
      ),
      Effect.map(
        ({ id, signal }) =>
          [
            signal.value as Effect.Effect<
              SignalState<
                StandardSchemaV1.InferOutput<
                  ServerSubscriptionHandlers[Handler]["config"]["response"]["validator"]
                >
              >,
              never,
              SignalContext
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
  ) {
    return pipe(
      Effect.Do,
      Effect.let("id", () => crypto.randomUUID() as string),
      Effect.bind("deferred", () => Deferred.make<unknown>()),
      Effect.let(
        "updater",
        ({ id, deferred }) =>
          (data: SuccessData) =>
            pipe(
              Deferred.succeed(deferred, data.value),
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
      Effect.bind("ws", () => client.ws),
      Effect.tap(({ ws, requestHeaderEncoded }) =>
        Option.map(ws, (ws) => ws.send(requestHeaderEncoded)),
      ),
      Effect.flatMap(
        ({ deferred }) =>
          Deferred.await(deferred) as Effect.Effect<
            StandardSchemaV1.InferOutput<
              ServerSubscriptionHandlers[Handler]["config"]["response"]["validator"]
            >,
            never,
            never
          >,
      ),
      Effect.withSpan("WebSocketClient.once"),
    );
  }
}
