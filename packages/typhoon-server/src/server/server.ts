import { Message, Peer } from "crossws";
import type { serve as crosswsServe } from "crossws/server";
import {
  Array,
  Boolean,
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
  Schema,
  Scope,
  String,
  Struct,
  SynchronizedRef,
} from "effect";
import { HandlerConfig, HandlerContextConfig } from "typhoon-core/config";
import { Header, Msgpack, Stream } from "typhoon-core/protocol";
import { Server as BaseServer } from "typhoon-core/server";
import { Computed, OnceObserver, SideEffect } from "typhoon-core/signal";
import { Validate } from "typhoon-core/validator";
import { parseURL, withoutTrailingSlash } from "ufo";
import {
  close as closeEvent,
  Event,
  fromEventContext,
  replacePullStream,
} from "./event";
import invalidHeaderErrorHtml from "./invalidHeaderError.html";

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
    handlerContextConfigGroup: HandlerContextConfig.Group.HandlerContextConfigGroup<
      R | Event
    >;
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
    status: SynchronizedRef.SynchronizedRef<"stopped" | "pending" | "ready">;
  }>
  implements BaseServer.Server
{
  readonly [BaseServer.ServerSymbol]: BaseServer.Server = this;
}

export const create = <R = never>(layer: Layer.Layer<R, unknown>) =>
  pipe(
    Effect.Do,
    Effect.bindAll(
      () => ({
        traceProvider: Effect.succeed(Layer.empty),
        handlerContextConfigGroup: Effect.succeed(
          HandlerContextConfig.Group.empty(),
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
        status: SynchronizedRef.make<"stopped" | "pending" | "ready">(
          "stopped",
        ),
      }),
      { concurrency: "unbounded" },
    ),
    Effect.map((params) => new Server<R>(params)),
  );

export const withTraceProvider =
  (traceProvider: Layer.Layer<never>) =>
  <R = never>(server: Server<R>): Server<R> =>
    new Server({
      ...server,
      traceProvider,
    });

export const add =
  <
    Config extends
      | HandlerContextConfig.SubscriptionHandlerContextConfig
      | HandlerContextConfig.MutationHandlerContextConfig,
  >(
    handler: Config,
  ) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <S extends Server<any>>(server: S) =>
    new Server(
      Struct.evolve(server, {
        handlerContextConfigGroup: HandlerContextConfig.Group.add(handler),
      }),
    ) as Exclude<
      HandlerContextConfig.HandlerContext<
        HandlerContextConfig.HandlerOrUndefined<Config>
      >,
      Event
    > extends ServerLayerContext<S>
      ? S
      : never;

export const addGroup =
  <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    G extends HandlerContextConfig.Group.HandlerContextConfigGroup<any>,
  >(
    handlerContextGroup: G,
  ) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <S extends Server<any>>(server: S) =>
    new Server(
      Struct.evolve(server, {
        handlerContextConfigGroup:
          HandlerContextConfig.Group.addGroup(handlerContextGroup),
      }),
    ) as Exclude<
      HandlerContextConfig.Group.HandlerContextConfigGroupContext<G>,
      Event
    > extends ServerLayerContext<S>
      ? S
      : never;

const open =
  (peer: Peer) =>
  <R = never>(server: Server<R>) =>
    pipe(
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

const close =
  (peer: Peer) =>
  <R = never>(server: Server<R>) =>
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

const updatePeerState =
  (
    peer: Peer,
    updater: (
      state: Option.Option<PeerState>,
    ) => Effect.Effect<Option.Option<PeerState>, unknown, never>,
  ) =>
  <R = never>(server: Server<R>) =>
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

const updatePeerSubscriptionState = (
  peer: Peer,
  subscriptionId: string,
  updater: (
    state: Option.Option<SubscriptionState>,
  ) => Effect.Effect<Option.Option<SubscriptionState>, unknown, never>,
) =>
  updatePeerState(peer, (peerState) =>
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

const getComputedSubscriptionResult = <R = never>(
  subscriptionId: string,
  subscriptionHandlerContextConfig: HandlerContextConfig.SubscriptionHandlerContextConfig<
    HandlerConfig.SubscriptionHandlerConfig,
    HandlerContextConfig.SubscriptionHandler<
      HandlerConfig.SubscriptionHandlerConfig,
      R | Event,
      R | Event
    >
  >,
): Effect.Effect<
  Computed.Computed<
    {
      header: Header.Header<"server:update">;
      message: unknown;
    },
    never,
    R | Event
  >,
  unknown,
  R | Event
> =>
  pipe(
    HandlerContextConfig.handler(subscriptionHandlerContextConfig),
    Effect.flatMap((handler) =>
      Computed.make(
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
              handler: HandlerConfig.name(
                HandlerContextConfig.config(subscriptionHandlerContextConfig),
              ),
            },
          }),
          Effect.annotateLogs({
            handler: HandlerConfig.name(
              HandlerContextConfig.config(subscriptionHandlerContextConfig),
            ),
          }),
        ),
      ),
    ),
    Effect.withSpan("Server.getComputedSubscriptionResult", {
      captureStackTrace: true,
      attributes: {
        handler: HandlerConfig.name(
          HandlerContextConfig.config(subscriptionHandlerContextConfig),
        ),
      },
    }),
    Effect.annotateLogs({
      handler: HandlerConfig.name(
        HandlerContextConfig.config(subscriptionHandlerContextConfig),
      ),
    }),
  );

const getMutationResult = <R = never>(
  mutationId: string,
  mutationHandlerContextConfig: HandlerContextConfig.MutationHandlerContextConfig<
    HandlerConfig.MutationHandlerConfig,
    HandlerContextConfig.MutationHandler<
      HandlerConfig.MutationHandlerConfig,
      R | Event
    >
  >,
): Effect.Effect<
  {
    header: Header.Header<"server:update">;
    message: unknown;
  },
  unknown,
  Event | R
> =>
  pipe(
    Effect.Do,
    Effect.bind("value", () =>
      Effect.exit(HandlerContextConfig.handler(mutationHandlerContextConfig)),
    ),
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
        handler: HandlerConfig.name(
          HandlerContextConfig.config(mutationHandlerContextConfig),
        ),
      },
    }),
    Effect.annotateLogs({
      handler: HandlerConfig.name(
        HandlerContextConfig.config(mutationHandlerContextConfig),
      ),
    }),
  );

const getComputedSubscriptionResultEncoded = <R = never>(
  subscriptionId: string,
  subscriptionHandlerContextConfig: HandlerContextConfig.SubscriptionHandlerContextConfig<
    HandlerConfig.SubscriptionHandlerConfig,
    HandlerContextConfig.SubscriptionHandler<
      HandlerConfig.SubscriptionHandlerConfig,
      R | Event,
      R | Event
    >
  >,
) =>
  pipe(
    getComputedSubscriptionResult(
      subscriptionId,
      subscriptionHandlerContextConfig,
    ),
    Effect.flatMap((computedResult) =>
      Computed.make(
        pipe(
          Effect.Do,
          Effect.bind("result", () => computedResult),
          Effect.bind("header", ({ result }) =>
            Schema.encode(Header.HeaderSchema)(result.header),
          ),
          Effect.bind("headerEncoded", ({ header }) =>
            Msgpack.Encoder.encode(header),
          ),
          Effect.bind("messageEncoded", ({ result }) =>
            Msgpack.Encoder.encode(result.message),
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
        handler: HandlerConfig.name(
          HandlerContextConfig.config(subscriptionHandlerContextConfig),
        ),
      },
    }),
  );

const getMutationResultEncoded = <R = never>(
  mutationId: string,
  mutationHandlerContextConfig: HandlerContextConfig.MutationHandlerContextConfig<
    HandlerConfig.MutationHandlerConfig,
    HandlerContextConfig.MutationHandler<
      HandlerConfig.MutationHandlerConfig,
      R | Event
    >
  >,
) =>
  pipe(
    Effect.Do,
    Effect.bind("result", () =>
      getMutationResult(mutationId, mutationHandlerContextConfig),
    ),
    Effect.bind("header", ({ result }) =>
      Schema.encode(Header.HeaderSchema)(result.header),
    ),
    Effect.bind("headerEncoded", ({ header }) =>
      Msgpack.Encoder.encode(header),
    ),
    Effect.bind("messageEncoded", ({ result }) =>
      Msgpack.Encoder.encode(result.message),
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
        handler: HandlerConfig.name(
          HandlerContextConfig.config(mutationHandlerContextConfig),
        ),
      },
    }),
  );

const handleSubscribe =
  (
    peer: Peer,
    pullStream: Effect.Effect<
      unknown,
      Msgpack.Decoder.MsgpackDecodeError | Stream.StreamExhaustedError,
      never
    >,
    header: Header.Header<"client:subscribe">,
    scope: Scope.CloseableScope,
  ) =>
  <R = never>(server: Server<R>) =>
    pipe(
      server.subscribeTotal(Effect.succeed(BigInt(1))),
      Effect.andThen(() =>
        updatePeerSubscriptionState(peer, header.id, (subscriptionState) =>
          pipe(
            subscriptionState,
            Option.match({
              onSome: ({ event, effectCleanup }) =>
                pipe(
                  replacePullStream({
                    stream: pullStream,
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
                    fromEventContext({
                      request: peer.request,
                      pullStream: {
                        stream: pullStream,
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
                  Effect.bind("handlerContextConfig", () =>
                    pipe(
                      server.handlerContextConfigGroup,
                      HandlerContextConfig.Group.getSubscriptionHandlerContextConfig(
                        header.payload.handler,
                      ),
                      Effect.orElse(() =>
                        Effect.fail(
                          `handler ${header.payload.handler} not found`,
                        ),
                      ),
                    ),
                  ),
                  Effect.bind(
                    "computedBuffer",
                    ({ event, handlerContextConfig }) =>
                      pipe(
                        SynchronizedRef.get(server.runtime),
                        Effect.flatMap(
                          Option.match({
                            onSome: (runtime) =>
                              pipe(
                                getComputedSubscriptionResultEncoded(
                                  header.id,
                                  handlerContextConfig,
                                ),
                                Effect.provide(runtime),
                                Effect.provideService(Event, event),
                              ),
                            onNone: () =>
                              Effect.fail("scope layer not initialized"),
                          }),
                        ),
                      ),
                  ),
                  Effect.bind("providedComputedBuffer", ({ computedBuffer }) =>
                    Computed.make(
                      pipe(
                        SynchronizedRef.get(server.runtime),
                        Effect.flatMap(
                          Option.match({
                            onSome: (runtime) =>
                              pipe(computedBuffer, Effect.provide(runtime)),
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
                      SideEffect.make(
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

const handleUnsubscribe =
  (peer: Peer, header: Header.Header<"client:unsubscribe">) =>
  <R = never>(server: Server<R>) =>
    pipe(
      server.unsubscribeTotal(Effect.succeed(BigInt(1))),
      Effect.andThen(() =>
        updatePeerSubscriptionState(peer, header.id, (subscriptionState) =>
          pipe(
            Effect.succeed(subscriptionState),
            Effect.flatMap((subscriptionState) =>
              pipe(
                subscriptionState,
                Option.match({
                  onSome: ({ event, effectCleanup }) =>
                    pipe(
                      effectCleanup,
                      Effect.andThen(closeEvent()),
                      Effect.provideService(Event, event),
                      Effect.as(Option.none()),
                    ),
                  onNone: () => Effect.succeedNone,
                }),
              ),
            ),
          ),
        )(server),
      ),
    );

const handleOnce =
  <A, E = never>(
    pullStream: Effect.Effect<
      unknown,
      Msgpack.Decoder.MsgpackDecodeError | Stream.StreamExhaustedError,
      never
    >,
    request: Request,
    header: Header.Header<"client:once">,
    callback: (buffer: Uint8Array) => Effect.Effect<A, E, Event>,
    scope: Scope.CloseableScope,
  ) =>
  <R = never>(server: Server<R>) =>
    pipe(
      Effect.Do,
      Effect.tap(() => server.onceTotal(Effect.succeed(BigInt(1)))),
      Effect.bind("event", () =>
        fromEventContext({
          request,
          pullStream: {
            stream: pullStream,
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
      Effect.bind("handlerContextConfig", () =>
        pipe(
          server.handlerContextConfigGroup,
          HandlerContextConfig.Group.getSubscriptionHandlerContextConfig(
            header.payload.handler,
          ),
          Effect.orElse(() =>
            Effect.fail(`handler ${header.payload.handler} not found`),
          ),
        ),
      ),
      Effect.bind("computedBuffer", ({ event, handlerContextConfig }) =>
        pipe(
          SynchronizedRef.get(server.runtime),
          Effect.flatMap(
            Option.match({
              onSome: (runtime) =>
                pipe(
                  getComputedSubscriptionResultEncoded(
                    header.id,
                    handlerContextConfig,
                  ),
                  Effect.provide(runtime),
                  Effect.provideService(Event, event),
                ),
              onNone: () => Effect.fail("scope layer not initialized"),
            }),
          ),
        ),
      ),
      Effect.bind("providedComputedBuffer", ({ computedBuffer }) =>
        Computed.make(
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
        OnceObserver.observeOnce(
          pipe(
            providedComputedBuffer,
            Effect.flatMap((buffer) => callback(buffer)),
            Effect.tap(() => closeEvent()),
            Effect.provideService(Event, event),
          ),
        ),
      ),
      Effect.map(({ returnValue }) => returnValue),
      Effect.withSpan("Server.handleOnce", {
        captureStackTrace: true,
      }),
    );

const handleMutate =
  <A, E = never>(
    pullStream: Effect.Effect<
      unknown,
      Msgpack.Decoder.MsgpackDecodeError | Stream.StreamExhaustedError,
      never
    >,
    request: Request,
    header: Header.Header<"client:mutate">,
    callback: (buffer: Uint8Array) => Effect.Effect<A, E, Event>,
    scope: Scope.CloseableScope,
  ) =>
  <R = never>(server: Server<R>) =>
    pipe(
      Effect.Do,
      Effect.tap(() => server.mutationTotal(Effect.succeed(BigInt(1)))),
      Effect.bind("event", () =>
        fromEventContext({
          request,
          pullStream: {
            stream: pullStream,
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
      Effect.bind("handlerContextConfig", () =>
        pipe(
          server.handlerContextConfigGroup,
          HandlerContextConfig.Group.getMutationHandlerContextConfig(
            header.payload.handler,
          ),
          Effect.orElse(() =>
            Effect.fail(`handler ${header.payload.handler} not found`),
          ),
        ),
      ),
      Effect.bind("buffer", ({ event, handlerContextConfig }) =>
        pipe(
          SynchronizedRef.get(server.runtime),
          Effect.flatMap(
            Option.match({
              onSome: (runtime) =>
                pipe(
                  getMutationResultEncoded(header.id, handlerContextConfig),
                  Effect.provide(runtime),
                  Effect.provideService(Event, event),
                ),
              onNone: () => Effect.fail("scope layer not initialized"),
            }),
          ),
        ),
      ),
      Effect.bind("returnValue", ({ event, buffer }) =>
        OnceObserver.observeOnce(
          pipe(
            callback(buffer),
            Effect.tap(() => closeEvent()),
            Effect.provideService(Event, event),
          ),
        ),
      ),
      Effect.map(({ returnValue }) => returnValue),
      Effect.withSpan("Server.handleMutate", {
        captureStackTrace: true,
      }),
    );

const handleWebSocketMessage =
  (peer: Peer, message: Message) =>
  <R = never>(server: Server<R>) =>
    pipe(
      Effect.Do,
      Effect.bind("scope", () => Scope.make()),
      Effect.let("blob", () => message.blob()),
      Effect.bind("pullStream", ({ scope, blob }) =>
        pipe(
          Msgpack.Decoder.blobToStream(blob),
          Stream.toPullStream,
          Scope.extend(scope),
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
          Effect.either,
        ),
      ),
      Effect.flatMap(({ pullStream, header, scope }) =>
        pipe(
          header,
          Either.match({
            onLeft: () => Effect.void,
            onRight: (header) =>
              pipe(
                Match.value(header),
                Match.when({ action: "client:subscribe" }, (header) =>
                  handleSubscribe(peer, pullStream, header, scope)(server),
                ),
                Match.when({ action: "client:unsubscribe" }, (header) =>
                  handleUnsubscribe(peer, header)(server),
                ),
                Match.when({ action: "client:once" }, (header) =>
                  handleOnce(
                    pullStream,
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
                  handleMutate(
                    pullStream,
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

const handleProtocolWebRequest =
  (request: Request) =>
  <R = never>(server: Server<R>) =>
    pipe(
      Effect.Do,
      Effect.bind("scope", () => Scope.make()),
      Effect.bind("blob", () => Effect.promise(() => request.blob())),
      Effect.bind("pullStream", ({ blob, scope }) =>
        pipe(
          Msgpack.Decoder.blobToStream(blob),
          Stream.toPullStream,
          Scope.extend(scope),
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
          Effect.either,
        ),
      ),
      Effect.flatMap(({ pullStream, header, scope }) =>
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
                  handleOnce(
                    pullStream,
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
                  handleMutate(
                    pullStream,
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

const handleWebRequest =
  (request: Request) =>
  <R = never>(server: Server<R>) =>
    pipe(
      Match.value(withoutTrailingSlash(parseURL(request.url).pathname)),
      Match.when("/live", () =>
        handleLive((live) =>
          Effect.sync(() => new Response("", { status: live ? 200 : 500 })),
        )(server),
      ),
      Match.when("/ready", () =>
        handleReady((ready) =>
          Effect.sync(() => new Response("", { status: ready ? 200 : 500 })),
        )(server),
      ),
      Match.orElse(() => handleProtocolWebRequest(request)(server)),
    );

const isStarted = <R = never>(server: Server<R>) =>
  pipe(
    server.status,
    SynchronizedRef.get,
    Effect.map((status) => Array.contains(["pending", "ready"], status)),
  );

const isReady = <R = never>(server: Server<R>) =>
  pipe(
    server.status,
    SynchronizedRef.get,
    Effect.map((status) => String.Equivalence(status, "ready")),
  );

const handleLive =
  <A = never, E = never, R1 = never>(
    callback: (live: boolean) => Effect.Effect<A, E, R1>,
  ) =>
  <R2 = never>(server: Server<R2>) =>
    pipe(isStarted(server), Effect.flatMap(callback));

const handleReady =
  <A = never, E = never, R1 = never>(
    callback: (ready: boolean) => Effect.Effect<A, E, R1>,
  ) =>
  <R2 = never>(server: Server<R2>) =>
    pipe(
      Effect.Do,
      Effect.bindAll(
        () => ({
          start: isStarted(server),
          ready: isReady(server),
        }),
        { concurrency: "unbounded" },
      ),
      Effect.map(({ start, ready }) => Boolean.and(start, ready)),
      Effect.flatMap(callback),
    );

const start = <R = never>(server: Server<R>) =>
  server.startSemaphore.withPermits(1)(
    pipe(
      SynchronizedRef.update(server.status, () => "pending" as const),
      Effect.andThen(
        SynchronizedRef.update(server.runtime, () =>
          Option.some(ManagedRuntime.make(server.layer)),
        ),
      ),
      Effect.andThen(
        SynchronizedRef.update(server.status, () => "ready" as const),
      ),
      Effect.as(server),
    ),
  );

export const stop = <R = never>(server: Server<R>) =>
  pipe(
    SynchronizedRef.update(server.status, () => "pending" as const),
    Effect.andThen(
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
    ),
    Effect.andThen(
      SynchronizedRef.update(server.status, () => "stopped" as const),
    ),
    Effect.tap(() => Effect.log("Server is stopped")),
    Effect.as(server),
  );

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
      Effect.andThen(start),
      Effect.map((server) => {
        return serveFn({
          websocket: {
            open: (peer) => {
              return Effect.runPromise(
                pipe(
                  server,
                  handleServeAction(open(peer), () => Effect.void),
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
                    handleWebSocketMessage(peer, message),
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
                  handleServeAction(close(peer), () => Effect.void),
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
                handleServeAction(handleWebRequest(request), () =>
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
