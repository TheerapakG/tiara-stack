import { Message, Peer } from "crossws";
import type { serve as crosswsServe } from "crossws/server";
import {
  Array,
  Cause,
  Context,
  Data,
  DateTime,
  Effect,
  Either,
  Exit,
  Function,
  HashMap,
  Layer,
  ManagedRuntime,
  Match,
  Metric,
  Option,
  pipe,
  Scope,
  String,
  SynchronizedRef,
} from "effect";
import { HandlerConfig } from "typhoon-core/config";
import {
  Header,
  HeaderEncoderDecoder,
  MsgpackDecodeError,
  MsgpackEncoderDecoder,
  StreamExhaustedError,
} from "typhoon-core/protocol";
import { Server as BaseServer, ServerSymbol } from "typhoon-core/server";
import { Computed, computed, effect, observeOnce } from "typhoon-core/signal";
import { Event } from "./event";
import {
  AnyMutationHandlerContext,
  AnySubscriptionHandlerContext,
  MutationHandlerContext,
  MutationHandlerContextRequirement,
  SubscriptionHandlerContext,
  SubscriptionHandlerContextRequirement,
} from "./handler";
import { HandlerGroup } from "./handlerGroup";
import invalidHeaderErrorHtml from "./invalidHeaderError.html";

type SubscriptionHandlerMap<R> = HashMap.HashMap<
  string,
  SubscriptionHandlerContext<HandlerConfig.SubscriptionHandlerConfig, R, R>
>;
type MutationHandlerMap<R> = HashMap.HashMap<
  string,
  MutationHandlerContext<HandlerConfig.MutationHandlerConfig, R>
>;

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServerLayerContext<S extends Server<any>> =
  S extends Server<infer R> ? R : never;

export class Server<R = never>
  extends Data.TaggedClass("Server")<{
    traceProvider: Layer.Layer<never>;
    subscriptionHandlerMap: SubscriptionHandlerMap<R>;
    mutationHandlerMap: MutationHandlerMap<R>;
    peerStateMapRef: SynchronizedRef.SynchronizedRef<PeerStateMap>;
    peerActive: Metric.Metric.Gauge<bigint>;
    peerTotal: Metric.Metric.Counter<bigint>;
    subscribeTotal: Metric.Metric.Counter<bigint>;
    unsubscribeTotal: Metric.Metric.Counter<bigint>;
    onceTotal: Metric.Metric.Counter<bigint>;
    mutationTotal: Metric.Metric.Counter<bigint>;
    layer: Layer.Layer<R, unknown>;
    runtime: SynchronizedRef.SynchronizedRef<
      Option.Option<ManagedRuntime.ManagedRuntime<R, unknown>>
    >;
    startSemaphore: Effect.Semaphore;
  }>
  implements BaseServer
{
  readonly [ServerSymbol]: BaseServer = this;

  static create<R = never>(layer: Layer.Layer<R, unknown>) {
    return pipe(
      Effect.Do,
      Effect.bindAll(
        () => ({
          traceProvider: Effect.succeed(Layer.empty),
          subscriptionHandlerMap: Effect.succeed(
            HashMap.empty<
              string,
              SubscriptionHandlerContext<
                HandlerConfig.SubscriptionHandlerConfig,
                R,
                R
              >
            >(),
          ),
          mutationHandlerMap: Effect.succeed(
            HashMap.empty<
              string,
              MutationHandlerContext<HandlerConfig.MutationHandlerConfig, R>
            >(),
          ),
          peerStateMapRef: SynchronizedRef.make(
            HashMap.empty<
              string,
              {
                peer: Peer;
                subscriptionStateMap: SubscriptionStateMap;
              }
            >(),
          ),
          peerActive: Effect.succeed(
            Metric.gauge("typhoon_server_peer_active", {
              description:
                "The number of peers currently connected to the server",
              bigint: true,
            }),
          ),
          peerTotal: Effect.succeed(
            Metric.counter("typhoon_server_peer_total", {
              description: "The total number of peers connected to the server",
              bigint: true,
              incremental: true,
            }),
          ),
          subscribeTotal: Effect.succeed(
            Metric.counter("typhoon_server_subscribe_total", {
              description: "The total number of subscribe events",
              bigint: true,
              incremental: true,
            }),
          ),
          unsubscribeTotal: Effect.succeed(
            Metric.counter("typhoon_server_unsubscribe_total", {
              description: "The total number of unsubscribe events",
              bigint: true,
              incremental: true,
            }),
          ),
          onceTotal: Effect.succeed(
            Metric.counter("typhoon_server_once_total", {
              description: "The total number of once events",
              bigint: true,
              incremental: true,
            }),
          ),
          mutationTotal: Effect.succeed(
            Metric.counter("typhoon_server_mutation_total", {
              description: "The total number of mutation events",
              bigint: true,
              incremental: true,
            }),
          ),
          layer: Effect.succeed(layer),
          runtime: SynchronizedRef.make(
            Option.none<ManagedRuntime.ManagedRuntime<R, unknown>>(),
          ),
          startSemaphore: Effect.makeSemaphore(1),
        }),
        { concurrency: "unbounded" },
      ),
      Effect.map((params) => new Server<R>(params)),
    );
  }

  static withTraceProvider(traceProvider: Layer.Layer<never>) {
    return <R = never>(server: Server<R>): Server<R> => {
      return new Server({
        ...server,
        traceProvider,
      });
    };
  }

  // TODO: check handler requirement extends server requirement
  static add<
    Handler extends AnySubscriptionHandlerContext | AnyMutationHandlerContext,
  >(handler: Handler) {
    return <
      S extends Server<
        Handler extends AnySubscriptionHandlerContext
          ? SubscriptionHandlerContextRequirement<Handler>
          : Handler extends AnyMutationHandlerContext
            ? MutationHandlerContextRequirement<Handler>
            : never
      >,
    >(
      server: S,
    ) => {
      const newHandlerMaps = pipe(
        Match.value(HandlerConfig.type(handler.config)),
        Match.when("subscription", () => ({
          subscriptionHandlerMap: HashMap.set(
            server.subscriptionHandlerMap,
            HandlerConfig.name(
              handler.config as HandlerConfig.SubscriptionHandlerConfig,
            ),
            handler as SubscriptionHandlerContext,
          ),
          mutationHandlerMap: server.mutationHandlerMap,
        })),
        Match.when("mutation", () => ({
          subscriptionHandlerMap: server.subscriptionHandlerMap,
          mutationHandlerMap: HashMap.set(
            server.mutationHandlerMap,
            HandlerConfig.name(handler.config),
            handler as MutationHandlerContext,
          ),
        })),
        Match.orElseAbsurd,
      );

      // TODO: add handler map substitution helper
      return new Server({
        ...server,
        ...newHandlerMaps,
      }) as Server<ServerLayerContext<S>>;
    };
  }

  // TODO: check handler requirement extends server requirement
  static addGroup<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    G extends HandlerGroup<any>,
  >(handlerGroup: G) {
    return <
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      S extends Server<any>,
    >(
      server: S,
    ) =>
      // TODO: add handler map substitution helper
      new Server({
        ...server,
        subscriptionHandlerMap: HashMap.union(
          server.subscriptionHandlerMap,
          handlerGroup.subscriptionHandlerMap,
        ),
        mutationHandlerMap: HashMap.union(
          server.mutationHandlerMap,
          handlerGroup.mutationHandlerMap,
        ),
      }) as unknown as Server<ServerLayerContext<S>>;
  }

  static open(peer: Peer) {
    return <R = never>(server: Server<R>) => {
      return pipe(
        server.peerStateMapRef,
        SynchronizedRef.updateAndGet((peerStateMap) =>
          HashMap.set(peerStateMap, peer.id, {
            peer,
            subscriptionStateMap: HashMap.empty(),
          }),
        ),
        Effect.tap((peerStateMap) =>
          server.peerActive(Effect.succeed(BigInt(HashMap.size(peerStateMap)))),
        ),
        Effect.tap(() => server.peerTotal(Effect.succeed(BigInt(1)))),
        Effect.asVoid,
        Effect.withSpan("Server.open", {
          captureStackTrace: true,
        }),
      );
    };
  }

  static close(peer: Peer) {
    return <R = never>(server: Server<R>) =>
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
          server.peerActive(Effect.succeed(BigInt(HashMap.size(peerStateMap)))),
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
    return <R = never>(server: Server<R>) =>
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

  private static getComputedSubscriptionResult<R = never>(
    subscriptionId: string,
    subscriptionHandlerContext: SubscriptionHandlerContext<
      HandlerConfig.SubscriptionHandlerConfig,
      R,
      R
    >,
  ): Effect.Effect<
    Computed<
      {
        header: Header<"server:update">;
        message: unknown;
      },
      never,
      Event | R
    >,
    unknown,
    R
  > {
    return pipe(
      subscriptionHandlerContext.handler,
      Effect.flatMap((handler) =>
        computed(
          pipe(
            Effect.Do,
            Effect.bind("value", () => Effect.exit(handler)),
            Effect.bind("timestamp", () => DateTime.now),
            Effect.let(
              "header",
              ({ value, timestamp }) =>
                ({
                  protocol: "typh",
                  version: 1,
                  id: subscriptionId,
                  action: "server:update",
                  payload: {
                    success: Exit.isSuccess(value),
                    timestamp: DateTime.toDate(timestamp),
                  },
                }) as const,
            ),
            Effect.let("message", ({ value }) =>
              pipe(
                value,
                Exit.match({
                  onSuccess: Function.identity,
                  onFailure: Cause.squash,
                }),
              ),
            ),
            Effect.map(({ header, message }) => ({
              header,
              message,
            })),
            Effect.scoped,
            Effect.withSpan("subscriptionHandler", {
              captureStackTrace: true,
              attributes: {
                handler: HandlerConfig.name(subscriptionHandlerContext.config),
              },
            }),
            Effect.annotateLogs({
              handler: HandlerConfig.name(subscriptionHandlerContext.config),
            }),
          ),
        ),
      ),
      Effect.withSpan("Server.getComputedSubscriptionResult", {
        captureStackTrace: true,
        attributes: {
          handler: HandlerConfig.name(subscriptionHandlerContext.config),
        },
      }),
      Effect.annotateLogs({
        handler: HandlerConfig.name(subscriptionHandlerContext.config),
      }),
    );
  }

  private static getMutationResult<R = never>(
    mutationId: string,
    mutationHandlerContext: MutationHandlerContext<
      HandlerConfig.MutationHandlerConfig,
      R
    >,
  ): Effect.Effect<
    {
      header: Header<"server:update">;
      message: unknown;
    },
    unknown,
    Event | R
  > {
    return pipe(
      Effect.Do,
      Effect.bind("value", () => Effect.exit(mutationHandlerContext.handler)),
      Effect.bind("timestamp", () => DateTime.now),
      Effect.let(
        "header",
        ({ value, timestamp }) =>
          ({
            protocol: "typh",
            version: 1,
            id: mutationId,
            action: "server:update",
            payload: {
              success: Exit.isSuccess(value),
              timestamp: DateTime.toDate(timestamp),
            },
          }) as const,
      ),
      Effect.let("message", ({ value }) =>
        pipe(
          value,
          Exit.match({
            onSuccess: Function.identity,
            onFailure: Cause.squash,
          }),
        ),
      ),
      Effect.map(({ header, message }) => ({
        header,
        message,
      })),
      Effect.scoped,
      Effect.withSpan("Server.getMutationResult", {
        captureStackTrace: true,
        attributes: {
          handler: HandlerConfig.name(mutationHandlerContext.config),
        },
      }),
      Effect.annotateLogs({
        handler: HandlerConfig.name(mutationHandlerContext.config),
      }),
    );
  }

  private static getComputedSubscriptionResultEncoded<R = never>(
    subscriptionId: string,
    subscriptionHandlerContext: SubscriptionHandlerContext<
      HandlerConfig.SubscriptionHandlerConfig,
      R,
      R
    >,
  ) {
    return pipe(
      Server.getComputedSubscriptionResult(
        subscriptionId,
        subscriptionHandlerContext,
      ),
      Effect.flatMap((computedResult) =>
        computed(
          pipe(
            Effect.Do,
            Effect.bind("result", () => computedResult),
            Effect.bind("header", ({ result }) =>
              HeaderEncoderDecoder.encode(result.header),
            ),
            Effect.bind("headerEncoded", ({ header }) =>
              MsgpackEncoderDecoder.encode(header),
            ),
            Effect.bind("messageEncoded", ({ result }) =>
              MsgpackEncoderDecoder.encode(result.message),
            ),
            Effect.let("updateBuffer", ({ headerEncoded, messageEncoded }) => {
              const updateBuffer = new Uint8Array(
                headerEncoded.length + messageEncoded.length,
              );
              updateBuffer.set(headerEncoded, 0);
              updateBuffer.set(messageEncoded, headerEncoded.length);
              return updateBuffer;
            }),
            Effect.map(({ updateBuffer }) => updateBuffer),
          ),
        ),
      ),
      Effect.withSpan("Server.getComputedSubscriptionResultEncoded", {
        captureStackTrace: true,
        attributes: {
          handler: HandlerConfig.name(subscriptionHandlerContext.config),
        },
      }),
    );
  }

  private static getMutationResultEncoded<R = never>(
    mutationId: string,
    mutationHandlerContext: MutationHandlerContext<
      HandlerConfig.MutationHandlerConfig,
      R
    >,
  ) {
    return pipe(
      Effect.Do,
      Effect.bind("result", () =>
        Server.getMutationResult(mutationId, mutationHandlerContext),
      ),
      Effect.bind("header", ({ result }) =>
        HeaderEncoderDecoder.encode(result.header),
      ),
      Effect.bind("headerEncoded", ({ header }) =>
        MsgpackEncoderDecoder.encode(header),
      ),
      Effect.bind("messageEncoded", ({ result }) =>
        MsgpackEncoderDecoder.encode(result.message),
      ),
      Effect.let("updateBuffer", ({ headerEncoded, messageEncoded }) => {
        const updateBuffer = new Uint8Array(
          headerEncoded.length + messageEncoded.length,
        );
        updateBuffer.set(headerEncoded, 0);
        updateBuffer.set(messageEncoded, headerEncoded.length);
        return updateBuffer;
      }),
      Effect.map(({ updateBuffer }) => updateBuffer),
      Effect.withSpan("Server.getMutationResultEncoded", {
        captureStackTrace: true,
        attributes: {
          handler: HandlerConfig.name(mutationHandlerContext.config),
        },
      }),
    );
  }

  static handleSubscribe(
    peer: Peer,
    pullDecodedStream: Effect.Effect<
      unknown,
      MsgpackDecodeError | StreamExhaustedError,
      never
    >,
    header: Header<"client:subscribe">,
    scope: Scope.CloseableScope,
  ) {
    return <R = never>(server: Server<R>) =>
      pipe(
        server.subscribeTotal(Effect.succeed(BigInt(1))),
        Effect.andThen(() =>
          Server.updatePeerSubscriptionState(
            peer,
            header.id,
            (subscriptionState) =>
              pipe(
                subscriptionState,
                Option.match({
                  onSome: ({ event, effectCleanup }) =>
                    pipe(
                      Event.replacePullStream({
                        stream: pullDecodedStream,
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
                      Effect.bind("event", () =>
                        Event.fromEventContext({
                          request: peer.request,
                          pullStream: {
                            stream: pullDecodedStream,
                            scope,
                          },
                          token: pipe(
                            Option.fromNullable(header.payload.token),
                            Option.orElse(() =>
                              pipe(
                                Option.fromNullable(
                                  peer.request.headers.get("Authorization"),
                                ),
                                Option.map(String.split(" ")),
                                Option.filter((parts) =>
                                  Option.getEquivalence(String.Equivalence)(
                                    Array.get(parts, 0),
                                    Option.some("Bearer"),
                                  ),
                                ),
                                Option.flatMap(Array.get(1)),
                              ),
                            ),
                          ),
                        }),
                      ),
                      Effect.bind("handlerContext", () =>
                        pipe(
                          HashMap.get(
                            server.subscriptionHandlerMap,
                            header.payload.handler,
                          ),
                          Effect.orElse(() =>
                            Effect.fail(
                              `handler ${header.payload.handler} not found`,
                            ),
                          ),
                        ),
                      ),
                      Effect.bind("computedBuffer", ({ handlerContext }) =>
                        pipe(
                          SynchronizedRef.get(server.runtime),
                          Effect.flatMap(
                            Option.match({
                              onSome: (runtime) =>
                                pipe(
                                  Server.getComputedSubscriptionResultEncoded(
                                    header.id,
                                    handlerContext,
                                  ),
                                  Effect.provide(runtime),
                                ),
                              onNone: () =>
                                Effect.fail("scope layer not initialized"),
                            }),
                          ),
                        ),
                      ),
                      Effect.bind(
                        "providedComputedBuffer",
                        ({ computedBuffer }) =>
                          computed(
                            pipe(
                              SynchronizedRef.get(server.runtime),
                              Effect.flatMap(
                                Option.match({
                                  onSome: (runtime) =>
                                    pipe(
                                      computedBuffer,
                                      Effect.provide(runtime),
                                    ),
                                  onNone: () =>
                                    Effect.fail("scope layer not initialized"),
                                }),
                              ),
                            ),
                          ),
                      ),
                      Effect.bind(
                        "effectCleanup",
                        ({ event, providedComputedBuffer }) =>
                          effect(
                            pipe(
                              providedComputedBuffer,
                              Effect.tap((buffer) =>
                                peer.send(buffer, {
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
                Effect.withSpan("Server.handleSubscribe", {
                  captureStackTrace: true,
                }),
              ),
          )(server),
        ),
      );
  }

  static handleUnsubscribe(peer: Peer, header: Header<"client:unsubscribe">) {
    return <R = never>(server: Server<R>) =>
      pipe(
        server.unsubscribeTotal(Effect.succeed(BigInt(1))),
        Effect.andThen(() =>
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
        ),
      );
  }

  static handleOnce<A, E = never>(
    pullDecodedStream: Effect.Effect<
      unknown,
      MsgpackDecodeError | StreamExhaustedError,
      never
    >,
    request: Request,
    header: Header<"client:once">,
    callback: (buffer: Uint8Array) => Effect.Effect<A, E, Event>,
    scope: Scope.CloseableScope,
  ) {
    return <R = never>(server: Server<R>) =>
      pipe(
        Effect.Do,
        Effect.tap(() => server.onceTotal(Effect.succeed(BigInt(1)))),
        Effect.bind("event", () =>
          Event.fromEventContext({
            request,
            pullStream: {
              stream: pullDecodedStream,
              scope,
            },
            token: pipe(
              Option.fromNullable(header.payload.token),
              Option.orElse(() =>
                pipe(
                  Option.fromNullable(request.headers.get("Authorization")),
                  Option.map(String.split(" ")),
                  Option.filter((parts) =>
                    Option.getEquivalence(String.Equivalence)(
                      Array.get(parts, 0),
                      Option.some("Bearer"),
                    ),
                  ),
                  Option.flatMap(Array.get(1)),
                ),
              ),
            ),
          }),
        ),
        Effect.bind("handlerContext", () =>
          pipe(
            HashMap.get(server.subscriptionHandlerMap, header.payload.handler),
            Effect.orElse(() =>
              Effect.fail(`handler ${header.payload.handler} not found`),
            ),
          ),
        ),
        Effect.bind("computedBuffer", ({ handlerContext }) =>
          pipe(
            SynchronizedRef.get(server.runtime),
            Effect.flatMap(
              Option.match({
                onSome: (runtime) =>
                  pipe(
                    Server.getComputedSubscriptionResultEncoded(
                      header.id,
                      handlerContext,
                    ),
                    Effect.provide(runtime),
                  ),
                onNone: () => Effect.fail("scope layer not initialized"),
              }),
            ),
          ),
        ),
        Effect.bind("providedComputedBuffer", ({ computedBuffer }) =>
          computed(
            pipe(
              SynchronizedRef.get(server.runtime),
              Effect.flatMap(
                Option.match({
                  onSome: (runtime) =>
                    pipe(computedBuffer, Effect.provide(runtime)),
                  onNone: () => Effect.fail("scope layer not initialized"),
                }),
              ),
            ),
          ),
        ),
        Effect.bind("returnValue", ({ event, providedComputedBuffer }) =>
          observeOnce(
            pipe(
              providedComputedBuffer,
              Effect.flatMap((buffer) => callback(buffer)),
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
      unknown,
      MsgpackDecodeError | StreamExhaustedError,
      never
    >,
    request: Request,
    header: Header<"client:mutate">,
    callback: (buffer: Uint8Array) => Effect.Effect<A, E, Event>,
    scope: Scope.CloseableScope,
  ) {
    return <R = never>(server: Server<R>) =>
      pipe(
        Effect.Do,
        Effect.tap(() => server.mutationTotal(Effect.succeed(BigInt(1)))),
        Effect.bind("event", () =>
          Event.fromEventContext({
            request,
            pullStream: {
              stream: pullDecodedStream,
              scope,
            },
            token: pipe(
              Option.fromNullable(header.payload.token),
              Option.orElse(() =>
                pipe(
                  Option.fromNullable(request.headers.get("Authorization")),
                  Option.map(String.split(" ")),
                  Option.filter((parts) =>
                    Option.getEquivalence(String.Equivalence)(
                      Array.get(parts, 0),
                      Option.some("Bearer"),
                    ),
                  ),
                  Option.flatMap(Array.get(1)),
                ),
              ),
            ),
          }),
        ),
        Effect.bind("handlerContext", () =>
          pipe(
            HashMap.get(server.mutationHandlerMap, header.payload.handler),
            Effect.orElse(() =>
              Effect.fail(`handler ${header.payload.handler} not found`),
            ),
          ),
        ),
        Effect.bind("buffer", ({ event, handlerContext }) =>
          pipe(
            SynchronizedRef.get(server.runtime),
            Effect.flatMap(
              Option.match({
                onSome: (runtime) =>
                  pipe(
                    Server.getMutationResultEncoded(header.id, handlerContext),
                    Effect.provide(runtime),
                    Effect.provideService(Event, event),
                  ),
                onNone: () => Effect.fail("scope layer not initialized"),
              }),
            ),
          ),
        ),
        Effect.bind("returnValue", ({ event, buffer }) =>
          observeOnce(
            pipe(
              callback(buffer),
              Effect.tap(() => Event.close()),
              Effect.provideService(Event, event),
            ),
          ),
        ),
        Effect.map(({ returnValue }) => returnValue),
        Effect.withSpan("Server.handleMutate", {
          captureStackTrace: true,
        }),
      );
  }

  static handleWebSocketMessage(peer: Peer, message: Message) {
    return <R = never>(server: Server<R>) =>
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
            HeaderEncoderDecoder.decodeUnknownEffect(pullDecodedStream),
            Effect.either,
          ),
        ),
        Effect.flatMap(({ pullDecodedStream, header, scope }) =>
          pipe(
            header,
            Either.match({
              onLeft: () => Effect.void,
              onRight: (header) =>
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
                      peer.request,
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
                      peer.request,
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
                  Match.orElse(() => Effect.void),
                ),
            }),
          ),
        ),
        Effect.withSpan("Server.handleWebSocketMessage", {
          captureStackTrace: true,
        }),
      );
  }

  static handleWebRequest(request: Request) {
    return <R = never>(server: Server<R>) =>
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
            HeaderEncoderDecoder.decodeUnknownEffect(pullDecodedStream),
            Effect.either,
          ),
        ),
        Effect.flatMap(({ pullDecodedStream, header, scope }) =>
          pipe(
            header,
            Either.match({
              onLeft: () =>
                Effect.sync(
                  () =>
                    new Response(invalidHeaderErrorHtml, {
                      status: 400,
                      headers: {
                        "content-type": "text/html",
                      },
                    }),
                ),
              onRight: (header) =>
                pipe(
                  Match.value(header),
                  Match.when({ action: "client:once" }, (header) =>
                    Server.handleOnce(
                      pullDecodedStream,
                      request,
                      header,
                      (buffer) =>
                        Effect.sync(
                          () =>
                            new Response(buffer as unknown as BodyInit, {
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
                      request,
                      header,
                      (buffer) =>
                        Effect.sync(
                          () =>
                            new Response(buffer as unknown as BodyInit, {
                              status: 200,
                              headers: {
                                "content-type": "application/octet-stream",
                              },
                            }),
                        ),
                      scope,
                    )(server),
                  ),
                  Match.orElse(() =>
                    Effect.sync(() => new Response("", { status: 404 })),
                  ),
                ),
            }),
          ),
        ),
        Effect.withSpan("Server.handleWebRequest", {
          captureStackTrace: true,
        }),
      );
  }

  static start<R = never>(server: Server<R>) {
    return pipe(
      SynchronizedRef.update(server.runtime, () =>
        Option.some(ManagedRuntime.make(server.layer)),
      ),
      Effect.as(server),
      server.startSemaphore.withPermits(1),
    );
  }

  static stop<R = never>(server: Server<R>) {
    return pipe(
      SynchronizedRef.updateEffect(server.runtime, (runtime) =>
        pipe(
          runtime,
          Option.match({
            onSome: (runtime) => Effect.tryPromise(() => runtime.dispose()),
            onNone: () => Effect.void,
          }),
          Effect.as(Option.none()),
        ),
      ),
      Effect.tap(() => Effect.log("Server is stopped")),
      Effect.as(server),
    );
  }
}

const handleServeAction = <R = never, A = never, E = never>(
  action: (server: Server<R>) => Effect.Effect<A, E, never>,
  onError: (error: Cause.Cause<E>) => Effect.Effect<A, never, never>,
) => {
  return (server: Server<R>) =>
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
  <R>(serveFn: typeof crosswsServe) =>
  (server: Server<R>) => {
    return pipe(
      Effect.succeed(server),
      Effect.andThen(Server.start),
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
      // TODO: actual server closing method
      Effect.flatMap(() => Effect.makeLatch(false)),
    );
  };
