import { Message, Peer } from "crossws";
import type { serve as crosswsServe } from "crossws/server";
import {
  Cause,
  Chunk,
  Context,
  Data,
  Effect,
  Exit,
  HashMap,
  Layer,
  Match,
  Metric,
  Option,
  pipe,
  Scope,
  SynchronizedRef,
} from "effect";
import {
  Header,
  HeaderEncoderDecoder,
  MsgpackDecodeError,
  MsgpackEncoderDecoder,
  StreamExhaustedError,
} from "typhoon-core/protocol";
import { validate } from "typhoon-core/schema";
import { Server as BaseServer, ServerSymbol } from "typhoon-core/server";
import { effect, observeOnce } from "typhoon-core/signal";
import * as v from "valibot";
import { Event } from "./event";
import { MutationHandlerContext, SubscriptionHandlerContext } from "./handler";

type SubscriptionHandlerMap = HashMap.HashMap<
  string,
  SubscriptionHandlerContext
>;
type MutationHandlerMap = HashMap.HashMap<string, MutationHandlerContext>;

class Nonce extends Data.TaggedClass("Nonce")<{
  value: SynchronizedRef.SynchronizedRef<number>;
}> {
  static make() {
    return pipe(
      SynchronizedRef.make(0),
      Effect.map((value) => new Nonce({ value })),
    );
  }

  static getAndIncrement(nonce: Nonce) {
    return pipe(
      nonce.value,
      SynchronizedRef.updateAndGet((value) => value + 1),
    );
  }
}

type SubscriptionState = {
  event: Context.Tag.Service<Event>;
  effectCleanup: Effect.Effect<void, never, never>;
  nonce: Nonce;
};
type SubscriptionStateMap = HashMap.HashMap<string, SubscriptionState>;

type PeerState = {
  peer: Peer;
  subscriptionStateMap: SubscriptionStateMap;
};
type PeerStateMap = HashMap.HashMap<string, PeerState>;

export class Server<
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  SubscriptionHandlers extends Record<string, SubscriptionHandlerContext> = {},
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  MutationHandlers extends Record<string, MutationHandlerContext> = {},
> implements BaseServer<SubscriptionHandlers, MutationHandlers>
{
  readonly [ServerSymbol]: BaseServer<SubscriptionHandlers, MutationHandlers> =
    this;

  public traceProvider: Layer.Layer<never>;
  public subscriptionHandlerMap: SubscriptionHandlerMap;
  public mutationHandlerMap: MutationHandlerMap;
  public readonly peerStateMapRef: SynchronizedRef.SynchronizedRef<PeerStateMap>;
  public readonly peerCount: Metric.Metric.Gauge<bigint>;

  constructor(
    traceProvider: Layer.Layer<never>,
    subscriptionHandlerMap: SubscriptionHandlerMap,
    mutationHandlerMap: MutationHandlerMap,
    peerStateMapRef: SynchronizedRef.SynchronizedRef<PeerStateMap>,
  ) {
    this.traceProvider = traceProvider;
    this.subscriptionHandlerMap = subscriptionHandlerMap;
    this.mutationHandlerMap = mutationHandlerMap;
    this.peerStateMapRef = peerStateMapRef;
    this.peerCount = Metric.gauge("peer_count", {
      description: "The number of peers connected to the server",
      bigint: true,
    });
  }

  static create() {
    return pipe(
      SynchronizedRef.make(
        HashMap.empty<
          string,
          {
            peer: Peer;
            subscriptionStateMap: SubscriptionStateMap;
          }
        >(),
      ),
      Effect.map(
        (peerStateMapRef) =>
          new Server(
            Layer.empty,
            HashMap.empty(),
            HashMap.empty(),
            peerStateMapRef,
          ),
      ),
    );
  }

  static withTraceProvider(traceProvider: Layer.Layer<never>) {
    return <
      SubscriptionHandlers extends Record<
        string,
        SubscriptionHandlerContext
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      > = {},
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      MutationHandlers extends Record<string, MutationHandlerContext> = {},
    >(
      server: Server<SubscriptionHandlers, MutationHandlers>,
    ): Server<SubscriptionHandlers, MutationHandlers> => {
      return new Server(
        traceProvider,
        server.subscriptionHandlerMap,
        server.mutationHandlerMap,
        server.peerStateMapRef,
      );
    };
  }

  static add<
    Handler extends SubscriptionHandlerContext | MutationHandlerContext,
  >(handler: Handler) {
    return <
      SubscriptionHandlers extends Record<
        string,
        SubscriptionHandlerContext
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      > = {},
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      MutationHandlers extends Record<string, MutationHandlerContext> = {},
    >(
      server: Server<SubscriptionHandlers, MutationHandlers>,
    ): Handler extends SubscriptionHandlerContext
      ? Server<
          SubscriptionHandlers & {
            [K in Handler["config"]["name"]]: Handler;
          },
          MutationHandlers
        >
      : Handler extends MutationHandlerContext
        ? Server<
            SubscriptionHandlers,
            MutationHandlers & { [K in Handler["config"]["name"]]: Handler }
          >
        : never => {
      pipe(
        Match.value(handler.config),
        Match.when({ type: "subscription" }, () => {
          server.subscriptionHandlerMap = HashMap.set(
            server.subscriptionHandlerMap,
            handler.config.name,
            handler as SubscriptionHandlerContext,
          );
        }),
        Match.when({ type: "mutation" }, () => {
          server.mutationHandlerMap = HashMap.set(
            server.mutationHandlerMap,
            handler.config.name,
            handler as MutationHandlerContext,
          );
        }),
        Match.exhaustive,
      );

      return server as unknown as Handler extends SubscriptionHandlerContext
        ? Server<
            SubscriptionHandlers & {
              [K in Handler["config"]["name"]]: Handler;
            },
            MutationHandlers
          >
        : Handler extends MutationHandlerContext
          ? Server<
              SubscriptionHandlers,
              MutationHandlers & { [K in Handler["config"]["name"]]: Handler }
            >
          : never;
    };
  }

  static open(peer: Peer) {
    return (server: Server) => {
      return pipe(
        server.peerStateMapRef,
        SynchronizedRef.updateAndGet((peerStateMap) =>
          HashMap.set(peerStateMap, peer.id, {
            peer,
            subscriptionStateMap: HashMap.empty(),
          }),
        ),
        Effect.tap((peerStateMap) =>
          server.peerCount(Effect.succeed(BigInt(HashMap.size(peerStateMap)))),
        ),
        Effect.asVoid,
        Effect.withSpan("Server.open", {
          captureStackTrace: true,
        }),
      );
    };
  }

  static close(peer: Peer) {
    return (server: Server) =>
      pipe(
        server.peerStateMapRef,
        SynchronizedRef.updateAndGet((peerStateMap) =>
          HashMap.modifyAt(peerStateMap, peer.id, (peerState) => {
            Effect.runFork(
              pipe(
                peerState,
                Option.match({
                  onSome: ({ subscriptionStateMap }) =>
                    pipe(
                      subscriptionStateMap,
                      HashMap.values,
                      Effect.forEach(({ effectCleanup }) =>
                        Effect.forkDaemon(effectCleanup),
                      ),
                      Effect.asVoid,
                    ),
                  onNone: () => Effect.void,
                }),
              ),
            );

            return Option.none();
          }),
        ),
        Effect.tap((peerStateMap) =>
          server.peerCount(Effect.succeed(BigInt(HashMap.size(peerStateMap)))),
        ),
        Effect.asVoid,
        Effect.withSpan("Server.close", {
          captureStackTrace: true,
        }),
      );
  }

  private static updatePeerState(
    peer: Peer,
    updater: (
      state: Option.Option<PeerState>,
    ) => Effect.Effect<Option.Option<PeerState>, unknown, never>,
  ) {
    return (server: Server) =>
      pipe(
        server.peerStateMapRef,
        SynchronizedRef.updateEffect((peerStateMap) =>
          pipe(
            Effect.Do,
            Effect.let("peerState", () => HashMap.get(peerStateMap, peer.id)),
            Effect.bind("newPeerState", ({ peerState }) => updater(peerState)),
            Effect.let("newPeerStateMap", ({ newPeerState }) =>
              HashMap.modifyAt(peerStateMap, peer.id, () => newPeerState),
            ),
            Effect.map(({ newPeerStateMap }) => newPeerStateMap),
          ),
        ),
        Effect.withSpan("Server.updatePeerState", {
          captureStackTrace: true,
        }),
      );
  }

  private static updatePeerSubscriptionState(
    peer: Peer,
    subscriptionId: string,
    updater: (
      state: Option.Option<SubscriptionState>,
    ) => Effect.Effect<Option.Option<SubscriptionState>, unknown, never>,
  ) {
    return Server.updatePeerState(peer, (peerState) =>
      pipe(
        Effect.Do,
        Effect.let("peerState", () =>
          pipe(
            peerState,
            Option.getOrElse(
              () =>
                ({
                  peer,
                  subscriptionStateMap: HashMap.empty(),
                }) as PeerState,
            ),
          ),
        ),
        Effect.let(
          "subscriptionStateMap",
          ({ peerState }) => peerState.subscriptionStateMap,
        ),
        Effect.let("subscriptionState", ({ subscriptionStateMap }) =>
          HashMap.get(subscriptionStateMap, subscriptionId),
        ),
        Effect.bind("newSubscriptionState", ({ subscriptionState }) =>
          updater(subscriptionState),
        ),
        Effect.let(
          "newSubscriptionStateMap",
          ({ subscriptionStateMap, newSubscriptionState }) =>
            HashMap.modifyAt(
              subscriptionStateMap,
              subscriptionId,
              () => newSubscriptionState,
            ),
        ),
        Effect.map(({ peerState, newSubscriptionStateMap }) =>
          Option.some({
            ...peerState,
            subscriptionStateMap: newSubscriptionStateMap,
          }),
        ),
        Effect.withSpan("Server.updatePeerSubscriptionState", {
          captureStackTrace: true,
        }),
      ),
    );
  }

  private static runBoundedEventHandler(
    subscriptionId: string,
    subscriptionHandlerContext: SubscriptionHandlerContext,
    nonce: Nonce,
  ) {
    return pipe(
      Effect.Do,
      Effect.bind("update", () =>
        Effect.exit(
          pipe(
            subscriptionHandlerContext.handler,
            Effect.scoped,
            Effect.withSpan(
              `subscriptionHandler:${subscriptionHandlerContext.config.name}`,
              {
                captureStackTrace: true,
              },
            ),
          ),
        ),
      ),
      Effect.bind("nonce", () => Nonce.getAndIncrement(nonce)),
      Effect.let(
        "header",
        ({ update, nonce }) =>
          ({
            protocol: "typh",
            version: 1,
            id: subscriptionId,
            action: "server:update",
            payload: {
              success: Exit.isSuccess(update),
              nonce,
            },
          }) as const,
      ),
      Effect.let("message", ({ update }) =>
        pipe(
          update,
          Exit.match({
            onSuccess: (value) => value,
            onFailure: (cause) => pipe(cause, Cause.pretty),
          }),
        ),
      ),
      Effect.map(({ header, message }) => ({
        header,
        message,
      })),
      Effect.withSpan("Server.runBoundedEventHandler", {
        captureStackTrace: true,
      }),
    );
  }

  private static runBoundedEncodedEventHandler(
    subscriptionId: string,
    subscriptionHandlerContext: SubscriptionHandlerContext,
    nonce: Nonce,
  ) {
    return pipe(
      Server.runBoundedEventHandler(
        subscriptionId,
        subscriptionHandlerContext,
        nonce,
      ),
      Effect.bind("updateHeader", ({ header }) =>
        HeaderEncoderDecoder.encode(header),
      ),
      Effect.bind("updateHeaderEncoded", ({ updateHeader }) =>
        MsgpackEncoderDecoder.encode(updateHeader),
      ),
      Effect.bind("updateMessageEncoded", ({ message }) =>
        MsgpackEncoderDecoder.encode(message),
      ),
      Effect.let(
        "updateBuffer",
        ({ updateHeaderEncoded, updateMessageEncoded }) => {
          const updateBuffer = new Uint8Array(
            updateHeaderEncoded.length + updateMessageEncoded.length,
          );
          updateBuffer.set(updateHeaderEncoded, 0);
          updateBuffer.set(updateMessageEncoded, updateHeaderEncoded.length);
          return updateBuffer;
        },
      ),
      Effect.map(({ updateBuffer }) => updateBuffer),
      Effect.withSpan("Server.runBoundedEncodedEventHandler", {
        captureStackTrace: true,
      }),
    );
  }

  static handleSubscribe(
    peer: Peer,
    pullDecodedStream: Effect.Effect<
      Chunk.Chunk<unknown>,
      MsgpackDecodeError | StreamExhaustedError,
      never
    >,
    header: Header<"client:subscribe">,
    scope: Scope.CloseableScope,
  ) {
    return (server: Server) =>
      Server.updatePeerSubscriptionState(peer, header.id, (subscriptionState) =>
        pipe(
          subscriptionState,
          Option.match({
            onSome: ({ event, effectCleanup, nonce }) =>
              pipe(
                Event.replaceStreamContext({
                  pullStream: pullDecodedStream,
                  scope,
                }),
                Effect.map((event) => ({
                  event,
                  effectCleanup,
                  nonce,
                })),
                Effect.option,
                Effect.provideService(Event, event),
              ),
            onNone: () =>
              pipe(
                Effect.Do,
                Effect.let("event", () =>
                  Event.fromPullStreamContext({
                    pullStream: pullDecodedStream,
                    scope,
                  }),
                ),
                Effect.bind("handlerContext", () =>
                  HashMap.get(
                    server.subscriptionHandlerMap,
                    // TODO: validate header.payload.handler
                    header.payload.handler,
                  ),
                ),
                Effect.bind("nonce", () => Nonce.make()),
                Effect.bind(
                  "effectCleanup",
                  ({ event, handlerContext, nonce }) =>
                    effect(
                      pipe(
                        Server.runBoundedEncodedEventHandler(
                          header.id,
                          handlerContext,
                          nonce,
                        ),
                        Effect.tap((boundedEventHandler) =>
                          peer.send(boundedEventHandler, {
                            compress: true,
                          }),
                        ),
                        Effect.provideService(Event, event),
                      ),
                    ),
                ),
                Effect.map(({ event, effectCleanup, nonce }) =>
                  Option.some({
                    event,
                    effectCleanup,
                    nonce,
                  }),
                ),
              ),
          }),
          Effect.withSpan("Server.handleSubscribe", {
            captureStackTrace: true,
          }),
        ),
      )(server);
  }

  static handleUnsubscribe(peer: Peer, header: Header<"client:unsubscribe">) {
    return Server.updatePeerSubscriptionState(
      peer,
      header.id,
      (subscriptionState) =>
        pipe(
          Effect.succeed(subscriptionState),
          Effect.flatMap((subscriptionState) =>
            pipe(
              subscriptionState,
              Option.match({
                onSome: ({ event, effectCleanup }) =>
                  pipe(
                    effectCleanup,
                    Effect.andThen(Event.close()),
                    Effect.provideService(Event, event),
                    Effect.as(Option.none()),
                  ),
                onNone: () => Effect.succeed(Option.none()),
              }),
            ),
          ),
        ),
    );
  }

  static handleOnce<A, E = never>(
    pullDecodedStream: Effect.Effect<
      Chunk.Chunk<unknown>,
      MsgpackDecodeError | StreamExhaustedError,
      never
    >,
    header: Header<"client:once">,
    callback: (buffer: Uint8Array) => Effect.Effect<A, E, Event>,
    scope: Scope.CloseableScope,
  ) {
    return (server: Server) =>
      pipe(
        Effect.Do,
        Effect.let("event", () =>
          Event.fromPullStreamContext({
            pullStream: pullDecodedStream,
            scope,
          }),
        ),
        Effect.bind("handlerContext", () =>
          HashMap.get(server.subscriptionHandlerMap, header.payload.handler),
        ),
        Effect.bind("nonce", () => Nonce.make()),
        Effect.bind("returnValue", ({ event, handlerContext, nonce }) =>
          observeOnce(
            pipe(
              Server.runBoundedEncodedEventHandler(
                header.id,
                handlerContext,
                nonce,
              ),
              Effect.flatMap((returnBuffer) => callback(returnBuffer)),
              Effect.tap(() => Event.close()),
              Effect.provideService(Event, event),
            ),
          ),
        ),
        Effect.map(({ returnValue }) => returnValue),
        Effect.withSpan("Server.handleOnce", {
          captureStackTrace: true,
        }),
      );
  }

  static handleMutate<A, E = never>(
    pullDecodedStream: Effect.Effect<
      Chunk.Chunk<unknown>,
      MsgpackDecodeError | StreamExhaustedError,
      never
    >,
    header: Header<"client:mutate">,
    callback: Effect.Effect<A, E, Event>,
    scope: Scope.CloseableScope,
  ) {
    return (server: Server) =>
      pipe(
        Effect.Do,
        Effect.let("event", () =>
          Event.fromPullStreamContext({
            pullStream: pullDecodedStream,
            scope,
          }),
        ),
        Effect.bind("handlerContext", () =>
          HashMap.get(server.mutationHandlerMap, header.payload.handler),
        ),
        Effect.bind("returnValue", ({ event, handlerContext }) =>
          pipe(
            handlerContext.handler,
            Effect.scoped,
            Effect.withSpan(`mutationHandler:${handlerContext.config.name}`, {
              captureStackTrace: true,
            }),
            Effect.flatMap(() => callback),
            Effect.tap(() => Event.close()),
            Effect.provideService(Event, event),
          ),
        ),
        Effect.map(({ returnValue }) => returnValue),
        Effect.withSpan("Server.handleMutate", {
          captureStackTrace: true,
        }),
      );
  }

  static handleWebSocketMessage(peer: Peer, message: Message) {
    return (server: Server) =>
      pipe(
        Effect.Do,
        Effect.bind("scope", () => Scope.make()),
        Effect.let("blob", () => message.blob()),
        Effect.bind("pullDecodedStream", ({ scope, blob }) =>
          pipe(
            MsgpackEncoderDecoder.blobToPullDecodedStream(blob),
            Scope.extend(scope),
          ),
        ),
        Effect.bind("header", ({ pullDecodedStream }) =>
          pipe(
            pullDecodedStream,
            Effect.flatMap(Chunk.get(0)),
            Effect.flatMap(
              validate(v.array(v.tuple([v.number(), v.unknown()]))),
            ),
            Effect.flatMap(HeaderEncoderDecoder.decode),
          ),
        ),
        Effect.flatMap(({ pullDecodedStream, header, scope }) =>
          pipe(
            Match.value(header),
            Match.when({ action: "client:subscribe" }, (header) =>
              Server.handleSubscribe(
                peer,
                pullDecodedStream,
                header,
                scope,
              )(server),
            ),
            Match.when({ action: "client:unsubscribe" }, (header) =>
              Server.handleUnsubscribe(peer, header)(server),
            ),
            Match.when({ action: "client:once" }, (header) =>
              Server.handleOnce(
                pullDecodedStream,
                header,
                (buffer) =>
                  Effect.sync(() => {
                    peer.send(buffer, {
                      compress: true,
                    });
                  }),
                scope,
              )(server),
            ),
            Match.when({ action: "client:mutate" }, (header) =>
              Server.handleMutate(
                pullDecodedStream,
                header,
                Effect.void,
                scope,
              )(server),
            ),
            Match.orElse(() => Effect.void),
          ),
        ),
        Effect.withSpan("Server.handleWebSocketMessage", {
          captureStackTrace: true,
        }),
      );
  }

  static handleWebRequest(request: Request) {
    return (server: Server) =>
      pipe(
        Effect.Do,
        Effect.bind("scope", () => Scope.make()),
        Effect.bind("blob", () => Effect.promise(() => request.blob())),
        Effect.bind("pullDecodedStream", ({ blob, scope }) =>
          pipe(
            MsgpackEncoderDecoder.blobToPullDecodedStream(blob),
            Scope.extend(scope),
          ),
        ),
        Effect.bind("header", ({ pullDecodedStream }) =>
          pipe(
            pullDecodedStream,
            Effect.flatMap(Chunk.get(0)),
            Effect.flatMap(
              validate(v.array(v.tuple([v.number(), v.unknown()]))),
            ),
            Effect.flatMap(HeaderEncoderDecoder.decode),
          ),
        ),
        Effect.flatMap(({ pullDecodedStream, header, scope }) =>
          pipe(
            Match.value(header),
            Match.when({ action: "client:once" }, (header) =>
              Server.handleOnce(
                pullDecodedStream,
                header,
                (buffer) =>
                  Effect.sync(
                    () =>
                      new Response(buffer, {
                        status: 200,
                        headers: {
                          "content-type": "application/octet-stream",
                        },
                      }),
                  ),
                scope,
              )(server),
            ),
            Match.when({ action: "client:mutate" }, (header) =>
              Server.handleMutate(
                pullDecodedStream,
                header,
                Effect.sync(() => new Response("", { status: 200 })),
                scope,
              )(server),
            ),
            Match.orElse(() =>
              Effect.sync(() => new Response("", { status: 404 })),
            ),
          ),
        ),
        Effect.withSpan("Server.handleWebRequest", {
          captureStackTrace: true,
        }),
      );
  }
}

const handleServeAction = <A, E = never>(
  action: (server: Server) => Effect.Effect<A, E, never>,
  onError: (error: Cause.Cause<E>) => Effect.Effect<A, never, never>,
) => {
  return (server: Server) =>
    pipe(
      server,
      action,
      Effect.exit,
      Effect.flatMap(
        Exit.match({
          onSuccess: (response) => Effect.succeed(response),
          onFailure: (cause) =>
            pipe(
              Effect.Do,
              Effect.let("pretty", () => Cause.pretty(cause)),
              Effect.tap(({ pretty }) => Effect.log(pretty)),
              Effect.flatMap(() => onError(cause)),
            ),
        }),
      ),
      Effect.withSpan("serve.action", {
        captureStackTrace: true,
      }),
    );
};

export const serve =
  <
    SubscriptionHandlers extends Record<string, SubscriptionHandlerContext>,
    MutationHandlers extends Record<string, MutationHandlerContext>,
  >(
    serveFn: typeof crosswsServe,
  ) =>
  (server: Server<SubscriptionHandlers, MutationHandlers>) => {
    return pipe(
      Effect.succeed(server),
      Effect.map((server) => {
        return serveFn({
          websocket: {
            open: (peer) => {
              return Effect.runPromise(
                pipe(
                  server,
                  handleServeAction(Server.open(peer), () => Effect.void),
                  Effect.withSpan("serve.websocket.open", {
                    captureStackTrace: true,
                  }),
                  Effect.provide(server.traceProvider),
                ),
              );
            },

            message: (peer, message) => {
              return Effect.runPromise(
                pipe(
                  server,
                  handleServeAction(
                    Server.handleWebSocketMessage(peer, message),
                    () => Effect.void,
                  ),
                  Effect.withSpan("serve.websocket.message", {
                    captureStackTrace: true,
                  }),
                  Effect.provide(server.traceProvider),
                ),
              );
            },

            close: (peer, _event) => {
              return Effect.runPromise(
                pipe(
                  server,
                  handleServeAction(Server.close(peer), () => Effect.void),
                  Effect.withSpan("serve.websocket.close", {
                    captureStackTrace: true,
                  }),
                  Effect.provide(server.traceProvider),
                ),
              );
            },

            error: (peer, error) => {
              return Effect.runPromise(
                pipe(
                  Effect.log("[ws] error", peer, error),
                  Effect.withSpan("serve.websocket.error", {
                    captureStackTrace: true,
                  }),
                  Effect.provide(server.traceProvider),
                ),
              );
            },
          },
          fetch: (request) => {
            return Effect.runPromise(
              pipe(
                server,
                handleServeAction(Server.handleWebRequest(request), () =>
                  Effect.succeed(new Response("", { status: 500 })),
                ),
                Effect.withSpan("serve.fetch", {
                  captureStackTrace: true,
                }),
                Effect.provide(server.traceProvider),
              ),
            );
          },
        });
      }),
    );
  };

export type InferServerType<E extends Effect.Effect<unknown, unknown, never>> =
  E extends Effect.Effect<infer S, unknown, never>
    ? S extends Server<infer SubscriptionHandlers, infer MutationHandlers>
      ? BaseServer<SubscriptionHandlers, MutationHandlers>
      : never
    : never;
