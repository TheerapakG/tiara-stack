import { encode } from "@msgpack/msgpack";
import { match, type } from "arktype";
import { Message, Peer } from "crossws";
import type { serve as crosswsServe } from "crossws/server";
import {
  Chunk,
  Context,
  Effect,
  Exit,
  HashMap,
  Option,
  pipe,
  Scope,
  SynchronizedRef,
} from "effect";
import {
  blobToPullDecodedStream,
  Header,
  HeaderEncoderDecoder,
} from "typhoon-core/protocol";
import { validate } from "typhoon-core/schema";
import { Server as BaseServer, ServerSymbol } from "typhoon-core/server";
import { effect, observeOnce } from "typhoon-core/signal";
import { Event } from "./event";
import { MutationHandlerContext, SubscriptionHandlerContext } from "./handler";

type SubscriptionHandlerMap = HashMap.HashMap<
  string,
  SubscriptionHandlerContext
>;
type MutationHandlerMap = HashMap.HashMap<string, MutationHandlerContext>;

type SubscriptionState = {
  event: Context.Tag.Service<Event>;
  effectCleanup: Effect.Effect<void, never, never>;
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

  public subscriptionHandlerMap: SubscriptionHandlerMap;
  public mutationHandlerMap: MutationHandlerMap;
  public readonly peerStateMapRef: SynchronizedRef.SynchronizedRef<PeerStateMap>;

  constructor(
    subscriptionHandlerMap: SubscriptionHandlerMap,
    mutationHandlerMap: MutationHandlerMap,
    peerStateMapRef: SynchronizedRef.SynchronizedRef<PeerStateMap>,
  ) {
    this.subscriptionHandlerMap = subscriptionHandlerMap;
    this.mutationHandlerMap = mutationHandlerMap;
    this.peerStateMapRef = peerStateMapRef;
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
          new Server(HashMap.empty(), HashMap.empty(), peerStateMapRef),
      ),
    );
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
      match
        .in<SubscriptionHandlerContext | MutationHandlerContext>()
        .case({ config: { type: "'subscription'" } }, (handler) => {
          server.subscriptionHandlerMap = HashMap.set(
            server.subscriptionHandlerMap,
            handler.config.name,
            handler,
          );
        })
        .case({ config: { type: "'mutation'" } }, (handler) => {
          server.mutationHandlerMap = HashMap.set(
            server.mutationHandlerMap,
            handler.config.name,
            handler,
          );
        })
        .default("never")(handler);
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
        SynchronizedRef.update((peerStateMap) =>
          HashMap.set(peerStateMap, peer.id, {
            peer,
            subscriptionStateMap: HashMap.empty(),
          }),
        ),
        Effect.asVoid,
      );
    };
  }

  static close(peer: Peer) {
    return (server: Server) =>
      pipe(
        server.peerStateMapRef,
        SynchronizedRef.update((peerStateMap) =>
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
        Effect.asVoid,
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
        Effect.withSpan("updatePeerState", {
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
        Effect.withSpan("updatePeerSubscriptionState", {
          captureStackTrace: true,
        }),
      ),
    );
  }

  private static runBoundedEventHandler(
    subscriptionId: string,
    subscriptionHandlerContext: SubscriptionHandlerContext,
  ) {
    return pipe(
      Effect.Do,
      Effect.bind("boundedEventHandler", () =>
        pipe(
          Effect.Do,
          Effect.bind("update", () => subscriptionHandlerContext.handler),
          Effect.bind("updateHeader", () =>
            HeaderEncoderDecoder.encode({
              protocol: "typh",
              version: 1,
              id: subscriptionId,
              action: "server:update",
              payload: {},
            }),
          ),
          Effect.let("updateHeaderEncoded", ({ updateHeader }) =>
            encode(updateHeader),
          ),
          Effect.let("updateMessageEncoded", ({ update }) => encode(update)),
          Effect.let(
            "updateBuffer",
            ({ updateHeaderEncoded, updateMessageEncoded }) => {
              const updateBuffer = new Uint8Array(
                updateHeaderEncoded.length + updateMessageEncoded.length,
              );
              updateBuffer.set(updateHeaderEncoded, 0);
              updateBuffer.set(
                updateMessageEncoded,
                updateHeaderEncoded.length,
              );
              return updateBuffer;
            },
          ),
          Effect.map(({ updateBuffer }) => updateBuffer),
        ),
      ),
      Effect.map(({ boundedEventHandler }) => boundedEventHandler),
    );
  }

  static handleSubscribe(
    peer: Peer,
    pullDecodedStream: Effect.Effect<Chunk.Chunk<unknown>, unknown, never>,
    header: Header<"client:subscribe">,
    scope: Scope.CloseableScope,
  ) {
    return (server: Server) =>
      Server.updatePeerSubscriptionState(peer, header.id, (subscriptionState) =>
        pipe(
          subscriptionState,
          Option.match({
            onSome: ({ event, effectCleanup }) =>
              pipe(
                Event.replaceStreamContext({
                  pullStream: pullDecodedStream,
                  scope,
                }),
                Effect.map((event) => ({
                  event,
                  effectCleanup,
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
                Effect.bind("effectCleanup", ({ event, handlerContext }) =>
                  effect(
                    pipe(
                      Server.runBoundedEventHandler(header.id, handlerContext),
                      Effect.tap((boundedEventHandler) =>
                        peer.send(boundedEventHandler, {
                          compress: true,
                        }),
                      ),
                      Effect.provideService(Event, event),
                    ),
                  ),
                ),
                Effect.map(({ event, effectCleanup }) =>
                  Option.some({
                    event,
                    effectCleanup,
                  }),
                ),
              ),
          }),
        ),
      )(server);
  }

  static handleOnce<A, E = never>(
    pullDecodedStream: Effect.Effect<Chunk.Chunk<unknown>, unknown, never>,
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
        Effect.bind(
          "returnValue",
          ({ event, handlerContext }) =>
            observeOnce(
              pipe(
                Server.runBoundedEventHandler(header.id, handlerContext),
                Effect.flatMap((returnBuffer) => callback(returnBuffer)),
                Effect.tap(() => Event.close()),
                Effect.provideService(Event, event),
              ),
            ).value,
        ),
        Effect.map(({ returnValue }) => returnValue),
        Effect.withSpan("Server.handleOnce", {
          captureStackTrace: true,
        }),
      );
  }

  static handleMutate<A, E = never>(
    pullDecodedStream: Effect.Effect<Chunk.Chunk<unknown>, unknown, never>,
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
        Effect.let("handler", ({ handlerContext }) => handlerContext.handler),
        Effect.bind("returnValue", ({ event, handler }) =>
          pipe(
            handler,
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
          pipe(blobToPullDecodedStream(blob), Scope.extend(scope)),
        ),
        Effect.bind("header", ({ pullDecodedStream }) =>
          pipe(
            pullDecodedStream,
            Effect.flatMap(Chunk.get(0)),
            Effect.flatMap(validate(type([["number", "unknown"], "[]"]))),
            Effect.flatMap(HeaderEncoderDecoder.decode),
          ),
        ),
        Effect.flatMap(({ pullDecodedStream, header, scope }) =>
          match
            .in<Header>()
            .case({ action: "'client:subscribe'" }, () =>
              Server.handleSubscribe(
                peer,
                pullDecodedStream,
                header as Header<"client:subscribe">,
                scope,
              )(server),
            )
            .case({ action: "'client:unsubscribe'" }, () =>
              Server.updatePeerSubscriptionState(
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
              )(server),
            )
            .case({ action: "'client:once'" }, () =>
              Server.handleOnce(
                pullDecodedStream,
                header as Header<"client:once">,
                (buffer) =>
                  Effect.sync(() => {
                    peer.send(buffer, {
                      compress: true,
                    });
                  }),
                scope,
              )(server),
            )
            .case({ action: "'client:mutate'" }, () =>
              Server.handleMutate(
                pullDecodedStream,
                header as Header<"client:mutate">,
                Effect.void,
                scope,
              )(server),
            )
            .default(() => Effect.void)(header),
        ),
      );
  }

  static handleWebRequest(request: Request) {
    return (server: Server) =>
      pipe(
        Effect.Do,
        Effect.bind("scope", () => Scope.make()),
        Effect.bind("blob", () => Effect.promise(() => request.blob())),
        Effect.bind("pullDecodedStream", ({ blob, scope }) =>
          pipe(blobToPullDecodedStream(blob), Scope.extend(scope)),
        ),
        Effect.bind("header", ({ pullDecodedStream }) =>
          pipe(
            pullDecodedStream,
            Effect.flatMap(Chunk.get(0)),
            Effect.flatMap(validate(type([["number", "unknown"], "[]"]))),
            Effect.flatMap(HeaderEncoderDecoder.decode),
          ),
        ),
        Effect.flatMap(({ pullDecodedStream, header, scope }) =>
          match({})
            .case({ action: "'client:once'" }, () =>
              Server.handleOnce(
                pullDecodedStream,
                header as Header<"client:once">,
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
            )
            .case({ action: "'client:mutate'" }, () =>
              Server.handleMutate(
                pullDecodedStream,
                header as Header<"client:mutate">,
                Effect.sync(() => new Response("", { status: 200 })),
                scope,
              )(server),
            )
            .default(() =>
              Effect.sync(() => new Response("", { status: 404 })),
            )(header),
        ),
        Effect.withSpan("Server.handleWebRequest", {
          captureStackTrace: true,
        }),
      );
  }
}

const handleServeAction = <A, E = never>(
  action: (server: Server) => Effect.Effect<A, E, never>,
  onError: (error: E) => Effect.Effect<A, never, never>,
) => {
  return (server: Server) =>
    pipe(
      server,
      action,
      Effect.exit,
      Effect.flatMap(
        Exit.mapBoth({
          onSuccess: (response) => Effect.succeed(response),
          onFailure: (error) => {
            console.error("[serve] error", error);
            return onError(error);
          },
        }),
      ),
      Effect.merge,
      Effect.flatMap((result) => result),
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
                ),
              );
            },

            error: (peer, error) => {
              console.log("[ws] error", peer, error);
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
              ),
            );
          },
        });
      }),
    );
  };
