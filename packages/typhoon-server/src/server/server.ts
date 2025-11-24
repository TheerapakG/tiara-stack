import type { Message, Peer } from "crossws";
import type { serve as crosswsServe } from "crossws/server";
import {
  Array,
  Boolean,
  Cause,
  Context,
  Data,
  DateTime,
  Effect,
  Function,
  flow,
  Exit,
  HashMap,
  Layer,
  Match,
  Metric,
  Option,
  pipe,
  Runtime,
  Schema,
  Scope,
  String,
  Struct,
  SynchronizedRef,
  Tracer,
} from "effect";
import { Context as HandlerContext, type Type } from "typhoon-core/handler";
import { Header, Msgpack, Stream } from "typhoon-core/protocol";
import { RunState } from "typhoon-core/runtime";
import { Handler } from "typhoon-core/server";
import { Computed, UntilObserver, SideEffect } from "typhoon-core/signal";
import { parseURL, withoutTrailingSlash } from "ufo";
import {
  close as closeEvent,
  Event,
  makeEventService,
  type MsgpackPullEffect,
  pullEffect as eventPullEffect,
  replacePullStream,
} from "../event/event";
import { type HandlerContextCollection } from "../handler/context/collection";
import {
  Context as HandlerContextCore,
  type Context as HandlerContextCoreType,
} from "typhoon-core/handler";
import { type MutationHandlerT } from "../handler/context/mutation/type";
import { type SubscriptionHandlerT } from "../handler/context/subscription/type";
import invalidHeaderErrorHtml from "./invalidHeaderError.html";

class SubscriptionState extends Data.TaggedClass("SubscriptionState")<{
  event: Context.Tag.Service<Event>;
  scope: Scope.CloseableScope;
}> {}
type SubscriptionStateMap = HashMap.HashMap<string, SubscriptionState>;

class PeerState extends Data.TaggedClass("PeerState")<{
  peer: Peer;
  subscriptionStateMap: SubscriptionStateMap;
}> {}

const emptyPeerState = (peer: Peer) =>
  new PeerState({
    peer,
    subscriptionStateMap: HashMap.empty(),
  });

type PeerStateMap = HashMap.HashMap<string, PeerState>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServerContext<S extends Server<any>> =
  S extends Server<infer R> ? R : never;

interface ServerRunStateContextTypeLambda
  extends RunState.RunStateContextTypeLambda {
  readonly type: Server<this["R"]>;
}

type ServerData<R = never> = {
  traceProvider: Layer.Layer<never>;
  handlerContextCollection: HandlerContextCoreType.CollectionWithMetrics.HandlerContextCollectionWithMetrics<
    MutationHandlerT | SubscriptionHandlerT,
    R
  >;
  peerStateMapRef: SynchronizedRef.SynchronizedRef<PeerStateMap>;
  peerActive: Metric.Metric.Gauge<bigint>;
  peerTotal: Metric.Metric.Counter<bigint>;
  subscribeTotal: Metric.Metric.Counter<bigint>;
  unsubscribeTotal: Metric.Metric.Counter<bigint>;
  onceTotal: Metric.Metric.Counter<bigint>;
  mutationTotal: Metric.Metric.Counter<bigint>;
  runState: RunState.RunState<
    ServerRunStateContextTypeLambda,
    void,
    Cause.UnknownException
  >;
};

export class Server<R = never> extends Data.TaggedClass("Server")<
  ServerData<R>
> {}

export class ServerWithRuntime<R = never> extends Data.TaggedClass(
  "ServerWithRuntime",
)<{
  server: Server<R>;
  runtime: Runtime.Runtime<R>;
}> {}

const makeServeEffect =
  (serveFn: typeof crosswsServe) =>
  <R = never>(server: Server<R>, runtime: Runtime.Runtime<R>) =>
    pipe(
      Effect.Do,
      Effect.let(
        "serverWithRuntime",
        () => new ServerWithRuntime({ server, runtime }),
      ),
      Effect.tap(() =>
        HandlerContextCore.CollectionWithMetrics.initialize(
          server.handlerContextCollection,
        ),
      ),
      Effect.flatMap(({ serverWithRuntime }) =>
        Effect.try(() =>
          serveFn({
            websocket: {
              open: (peer) => {
                return Effect.runPromise(
                  pipe(
                    serverWithRuntime,
                    open(peer),
                    transformErrorResult(() => Effect.void),
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
                    Effect.currentSpan,
                    Effect.flatMap((span) =>
                      pipe(
                        serverWithRuntime,
                        handleProtocolWebSocketMessage(peer, message, span),
                        transformErrorResult(() => Effect.void),
                      ),
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
                    serverWithRuntime,
                    close(peer),
                    transformErrorResult(() => Effect.void),
                    Effect.withSpan("serve.websocket.close", {
                      captureStackTrace: true,
                    }),
                    Effect.provide(server.traceProvider),
                  ),
                );
              },

              error: (peer) => {
                return Effect.runPromise(
                  pipe(
                    serverWithRuntime,
                    close(peer),
                    transformErrorResult(() => Effect.void),
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
                  Effect.currentSpan,
                  Effect.flatMap((span) =>
                    pipe(
                      serverWithRuntime,
                      handleWebRequest(request, span),
                      transformErrorResult(() =>
                        Effect.succeed(new Response("", { status: 500 })),
                      ),
                    ),
                  ),
                  Effect.withSpan("serve.fetch", {
                    captureStackTrace: true,
                  }),
                  Effect.provide(server.traceProvider),
                ),
              );
            },
          }),
        ),
      ),
      Effect.andThen(Effect.makeLatch()),
      Effect.andThen((latch) => latch.await),
    );

export const create = <R = never>(serveFn: typeof crosswsServe) =>
  pipe(
    Effect.Do,
    Effect.bindAll(
      () => ({
        traceProvider: Effect.succeed(Layer.empty),
        handlerContextCollection: Effect.succeed(
          HandlerContextCore.CollectionWithMetrics.make(
            (
              context:
                | HandlerContextCore.HandlerContext<MutationHandlerT>
                | HandlerContextCore.HandlerContext<SubscriptionHandlerT>,
            ) =>
              pipe(
                Match.value(HandlerContextCore.data(context)),
                Match.tagsExhaustive({
                  PartialMutationHandlerConfig: () => "mutation" as const,
                  PartialSubscriptionHandlerConfig: () =>
                    "subscription" as const,
                }),
              ),
            HandlerContextCore.Collection.empty<
              MutationHandlerT | SubscriptionHandlerT,
              R
            >(
              {
                subscription: (config) =>
                  Handler.Config.Subscription.name(config),
                mutation: (config) => Handler.Config.Mutation.name(config),
              },
              (context) =>
                pipe(
                  Match.value(HandlerContextCore.data(context)),
                  Match.tagsExhaustive({
                    PartialMutationHandlerConfig: () => "mutation" as const,
                    PartialSubscriptionHandlerConfig: () =>
                      "subscription" as const,
                  }),
                ),
            ),
          ),
        ),
        peerStateMapRef: SynchronizedRef.make(
          HashMap.empty<string, PeerState>(),
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
        runState: RunState.make(makeServeEffect(serveFn), () => Effect.void),
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
    C extends
      | HandlerContext.HandlerContext<MutationHandlerT>
      | HandlerContext.HandlerContext<SubscriptionHandlerT>,
  >(
    handlerContext: C,
  ) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <S extends Server<any>>(server: S) =>
    new Server<
      | ServerContext<S>
      | Type.HandlerContext<
          HandlerContext.PartialHandlerContextHandlerT<C>,
          HandlerContext.HandlerOrUndefined<C>
        >
    >(
      Struct.evolve(server, {
        handlerContextCollection: (collection) =>
          HandlerContextCore.CollectionWithMetrics.add(
            handlerContext as
              | HandlerContext.HandlerContext<MutationHandlerT>
              | HandlerContext.HandlerContext<SubscriptionHandlerT>,
          )(
            collection as HandlerContextCoreType.CollectionWithMetrics.HandlerContextCollectionWithMetrics<
              MutationHandlerT | SubscriptionHandlerT,
              ServerContext<S>
            >,
          ),
      }) as ServerData<
        | ServerContext<S>
        | Type.HandlerContext<
            HandlerContext.PartialHandlerContextHandlerT<C>,
            HandlerContext.HandlerOrUndefined<C>
          >
      >,
    );

export const addCollection =
  <
    C extends HandlerContext.Collection.HandlerContextCollection<
      MutationHandlerT | SubscriptionHandlerT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    >,
  >(
    handlerContextCollection: C,
  ) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <S extends Server<any>>(server: S) =>
    new Server<
      | ServerContext<S>
      | HandlerContext.Collection.HandlerContextCollectionContext<C>
    >(
      Struct.evolve(server, {
        handlerContextCollection: (collection) =>
          HandlerContextCore.CollectionWithMetrics.addCollection(
            handlerContextCollection as HandlerContextCollection<
              HandlerContext.Collection.HandlerContextCollectionContext<C>
            >,
          )(collection),
      }),
    );

const updatePeerMetrics =
  (peerStateMap: PeerStateMap, increment: boolean) =>
  <R = never>(serverWithRuntime: ServerWithRuntime<R>) =>
    pipe(
      Effect.Do,
      Effect.bindAll(
        () => ({
          peerActive: serverWithRuntime.server.peerActive(
            Effect.succeed(BigInt(HashMap.size(peerStateMap))),
          ),
          peerTotal: serverWithRuntime.server.peerTotal(
            Effect.succeed(BigInt(increment ? 1 : 0)),
          ),
        }),
        { concurrency: "unbounded" },
      ),
      Effect.withSpan("Server.updatePeerMetrics", {
        captureStackTrace: true,
      }),
    );

const updatePeerState =
  <R = never>(
    peer: Peer,
    updaterEffect: (
      state: Option.Option<PeerState>,
    ) => Effect.Effect<Option.Option<PeerState>, unknown, R>,
  ) =>
  <R = never>(serverWithRuntime: ServerWithRuntime<R>) =>
    pipe(
      serverWithRuntime.server.peerStateMapRef,
      SynchronizedRef.updateAndGetEffect((peerStateMap) =>
        pipe(
          peerStateMap,
          HashMap.get(peer.id),
          updaterEffect,
          Effect.map((newPeerState) =>
            pipe(
              peerStateMap,
              HashMap.modifyAt(peer.id, () => newPeerState),
            ),
          ),
        ),
      ),
      Effect.withSpan("Server.updatePeerState", {
        captureStackTrace: true,
      }),
    );

const transformPeerSubscriptionState =
  <R = never>(
    subscriptionId: string,
    updaterOptions: {
      onSome: (
        state: SubscriptionState,
      ) => Effect.Effect<Option.Option<SubscriptionState>, unknown, R>;
      onNone: () => Effect.Effect<Option.Option<SubscriptionState>, unknown, R>;
    },
  ) =>
  (peerState: PeerState) =>
    pipe(
      peerState.subscriptionStateMap,
      HashMap.get(subscriptionId),
      Option.match(updaterOptions),
      Effect.map((newSubscriptionState) =>
        Option.some(
          Struct.evolve(peerState, {
            subscriptionStateMap: HashMap.modifyAt(
              subscriptionId,
              () => newSubscriptionState,
            ),
          }),
        ),
      ),
      Effect.withSpan("Server.transformPeerSubscriptionState", {
        captureStackTrace: true,
      }),
    );

const updatePeerSubscriptionState =
  <R = never>(
    peer: Peer,
    subscriptionId: string,
    updaterOptions: {
      onSome: (
        state: SubscriptionState,
      ) => Effect.Effect<Option.Option<SubscriptionState>, unknown, R>;
      onNone: () => Effect.Effect<Option.Option<SubscriptionState>, unknown, R>;
    },
  ) =>
  <R = never>(serverWithRuntime: ServerWithRuntime<R>) =>
    pipe(
      serverWithRuntime,
      updatePeerState(
        peer,
        Option.match({
          onSome: transformPeerSubscriptionState(
            subscriptionId,
            updaterOptions,
          ),
          onNone: () =>
            pipe(
              emptyPeerState(peer),
              transformPeerSubscriptionState(subscriptionId, updaterOptions),
            ),
        }),
      ),
      Effect.withSpan("Server.updatePeerSubscriptionState", {
        captureStackTrace: true,
      }),
    );

const open =
  (peer: Peer) =>
  <R = never>(serverWithRuntime: ServerWithRuntime<R>) =>
    pipe(
      serverWithRuntime,
      updatePeerState(peer, () => Effect.succeedSome(emptyPeerState(peer))),
      Effect.tap((peerStateMap) =>
        pipe(serverWithRuntime, updatePeerMetrics(peerStateMap, true)),
      ),
      Effect.asVoid,
      Effect.withSpan("Server.open", {
        captureStackTrace: true,
      }),
    );

const close =
  (peer: Peer) =>
  <R = never>(serverWithRuntime: ServerWithRuntime<R>) =>
    pipe(
      serverWithRuntime,
      updatePeerState(
        peer,
        Option.match({
          onSome: flow(
            (peerState) => peerState.subscriptionStateMap,
            HashMap.values,
            Effect.forEach(({ event, scope }) =>
              Effect.forkDaemon(
                pipe(
                  closeEvent(),
                  Effect.provideService(Event, event),
                  Effect.andThen(() => Scope.close(scope, Exit.void)),
                ),
              ),
            ),
            Effect.as(Option.none()),
          ),
          onNone: () => Effect.succeedNone,
        }),
      ),
      Effect.tap((peerStateMap) =>
        pipe(serverWithRuntime, updatePeerMetrics(peerStateMap, false)),
      ),
      Effect.asVoid,
      Effect.withSpan("Server.close", {
        captureStackTrace: true,
      }),
    );

class ServerUpdateResult extends Data.TaggedClass("ServerUpdateResult")<{
  header: Header.Header<"server:update">;
  message: unknown;
}> {}

const runHandler =
  (id: string, span: Tracer.Span) =>
  <R = never>(handler: Effect.Effect<unknown, unknown, R>) =>
    pipe(
      Effect.Do,
      Effect.bind("value", () =>
        Effect.exit(
          pipe(
            handler,
            Effect.withSpan("handler", { captureStackTrace: true }),
          ),
        ),
      ),
      Effect.bind("timestamp", () => DateTime.now),
      Effect.map(
        ({ value, timestamp }) =>
          new ServerUpdateResult({
            header: {
              protocol: "typh",
              version: 1,
              id,
              action: "server:update",
              payload: {
                success: Exit.isSuccess(value),
                timestamp: DateTime.toDate(timestamp),
              },
              span: {
                traceId: span.traceId,
                spanId: span.spanId,
              },
            } as const,
            message: pipe(
              value,
              Exit.match({
                onSuccess: Function.identity,
                onFailure: Cause.squash,
              }),
            ),
          }),
      ),
      Effect.scoped,
      Effect.withSpan("Server.runHandler", {
        captureStackTrace: true,
      }),
    );

const getComputedSubscriptionResult =
  (
    header: Header.Header<"client:subscribe" | "client:once">,
    span: Tracer.Span,
  ) =>
  <R = never>(
    serverWithRuntime: ServerWithRuntime<R>,
  ): Effect.Effect<
    Computed.Computed<ServerUpdateResult, never, Event>,
    unknown,
    Event | Scope.Scope
  > =>
    pipe(
      serverWithRuntime.server.handlerContextCollection,
      HandlerContextCore.CollectionWithMetrics.execute<
        MutationHandlerT | SubscriptionHandlerT,
        SubscriptionHandlerT
      >("subscription", header.payload.handler),
      Effect.flatMap(Option.getOrElse(() => Effect.fail(`handler not found`))),
      Effect.flatMap((innerHandler) =>
        Computed.make(
          pipe(
            runHandler(header.id, span)(innerHandler),
            Effect.provide(serverWithRuntime.runtime),
            Effect.withSpan("subscriptionHandler", {
              captureStackTrace: true,
              attributes: {
                id: header.id,
                handler: header.payload.handler,
              },
            }),
            Effect.annotateLogs({
              id: header.id,
              handler: header.payload.handler,
            }),
          ),
        ),
      ),
      Effect.provide(serverWithRuntime.runtime),
      Effect.withSpan("Server.getComputedSubscriptionResult", {
        captureStackTrace: true,
      }),
    );

const getMutationResult =
  (header: Header.Header<"client:mutate">, span: Tracer.Span) =>
  <R = never>(
    serverWithRuntime: ServerWithRuntime<R>,
  ): Effect.Effect<ServerUpdateResult, unknown, Event> =>
    pipe(
      runHandler(
        header.id,
        span,
      )(
        pipe(
          serverWithRuntime.server.handlerContextCollection,
          HandlerContextCore.CollectionWithMetrics.execute<
            MutationHandlerT | SubscriptionHandlerT,
            MutationHandlerT
          >("mutation", header.payload.handler),
          Effect.flatMap(
            Option.getOrElse(() => Effect.fail(`handler not found`)),
          ),
        ),
      ),
      Effect.provide(serverWithRuntime.runtime),
      Effect.withSpan("Server.getMutationResult", {
        captureStackTrace: true,
      }),
    );

const encodeServerUpdateResult = (result: ServerUpdateResult) =>
  pipe(
    Effect.Do,
    Effect.bindAll(
      () => ({
        headerEncoded: pipe(
          result.header,
          Schema.encode(Header.HeaderSchema),
          Effect.flatMap(Msgpack.Encoder.encode),
        ),
        messageEncoded: pipe(result.message, Msgpack.Encoder.encode),
      }),
      { concurrency: "unbounded" },
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
    Effect.withSpan("Server.encodeServerUpdateResult", {
      captureStackTrace: true,
    }),
  );

const handleSubscribe =
  (peer: Peer, header: Header.Header<"client:subscribe">, span: Tracer.Span) =>
  <R = never>(serverWithRuntime: ServerWithRuntime<R>) =>
    pipe(
      serverWithRuntime.server.subscribeTotal(Effect.succeed(BigInt(1))),
      Effect.andThen(() =>
        pipe(
          serverWithRuntime,
          updatePeerSubscriptionState(peer, header.id, {
            onSome: ({ event, scope }) =>
              pipe(
                eventPullEffect(),
                Effect.flatMap(UntilObserver.observeOnce),
                Effect.flatMap(replacePullStream),
                Effect.map((event) =>
                  Option.some(
                    new SubscriptionState({
                      event,
                      scope,
                    }),
                  ),
                ),
                Effect.provideService(Event, event),
              ),
            onNone: () =>
              pipe(
                Effect.Do,
                Effect.bind("scope", () => Scope.make()),
                Effect.bind("event", () => Event),
                Effect.bind("sideEffect", ({ event, scope }) =>
                  pipe(
                    serverWithRuntime,
                    getComputedSubscriptionResult(header, span),
                    Computed.tap((result) =>
                      Effect.log("result", header.id, result),
                    ),
                    Computed.flatMap(encodeServerUpdateResult),
                    SideEffect.tapWithContext(
                      (buffer) =>
                        pipe(
                          Effect.log("sending buffer to peer", header.id),
                          Effect.andThen(() =>
                            peer.send(buffer, {
                              compress: true,
                            }),
                          ),
                        ),
                      Context.make(Event, event),
                    ),
                    Scope.extend(scope),
                  ),
                ),
                Effect.map(({ event, scope }) =>
                  Option.some(
                    new SubscriptionState({
                      event,
                      scope,
                    }),
                  ),
                ),
              ),
          }),
        ),
      ),
      Effect.asVoid,
      Effect.withSpan("Server.handleSubscribe", {
        captureStackTrace: true,
        attributes: {
          id: header.id,
          handler: header.payload.handler,
        },
      }),
      Effect.annotateLogs({
        id: header.id,
        handler: header.payload.handler,
      }),
    );

const handleUnsubscribe =
  (
    peer: Peer,
    header: Header.Header<"client:unsubscribe">,
    _span: Tracer.Span,
  ) =>
  <R = never>(serverWithRuntime: ServerWithRuntime<R>) =>
    pipe(
      serverWithRuntime.server.unsubscribeTotal(Effect.succeed(BigInt(1))),
      Effect.andThen(() =>
        pipe(
          serverWithRuntime,
          updatePeerSubscriptionState(peer, header.id, {
            onSome: ({ event, scope }) =>
              pipe(
                closeEvent(),
                Effect.provideService(Event, event),
                Effect.andThen(() => Scope.close(scope, Exit.void)),
                Effect.as(Option.none()),
              ),
            onNone: () => Effect.succeedNone,
          }),
        ),
      ),
      Effect.asVoid,
      Effect.withSpan("Server.handleUnsubscribe", {
        captureStackTrace: true,
        attributes: {
          id: header.id,
        },
      }),
      Effect.annotateLogs({
        id: header.id,
      }),
    );

const handleOnce =
  <A, E = never>(
    header: Header.Header<"client:once">,
    callback: (buffer: Uint8Array) => Effect.Effect<A, E, Event>,
    span: Tracer.Span,
  ) =>
  <R = never>(serverWithRuntime: ServerWithRuntime<R>) =>
    pipe(
      Effect.Do,
      Effect.tap(() =>
        serverWithRuntime.server.onceTotal(Effect.succeed(BigInt(1))),
      ),
      Effect.andThen(() =>
        pipe(
          serverWithRuntime,
          getComputedSubscriptionResult(header, span),
          Computed.flatMap(encodeServerUpdateResult),
          Computed.flatMap((buffer) => callback(buffer)),
          Computed.tap(() => closeEvent()),
          UntilObserver.observeOnceScoped(),
        ),
      ),
      Effect.withSpan("Server.handleOnce", {
        captureStackTrace: true,
        attributes: {
          id: header.id,
          handler: header.payload.handler,
        },
      }),
      Effect.annotateLogs({
        id: header.id,
        handler: header.payload.handler,
      }),
    );

const handleMutate =
  <A, E = never>(
    header: Header.Header<"client:mutate">,
    callback: (buffer: Uint8Array) => Effect.Effect<A, E, Event>,
    span: Tracer.Span,
  ) =>
  <R = never>(serverWithRuntime: ServerWithRuntime<R>) =>
    pipe(
      Effect.Do,
      Effect.tap(() =>
        serverWithRuntime.server.mutationTotal(Effect.succeed(BigInt(1))),
      ),
      Effect.andThen(() =>
        pipe(
          serverWithRuntime,
          getMutationResult(header, span),
          Effect.flatMap(encodeServerUpdateResult),
          Effect.flatMap((buffer) => callback(buffer)),
          Effect.tap(() => closeEvent()),
        ),
      ),
      Effect.withSpan("Server.handleMutate", {
        captureStackTrace: true,
        attributes: {
          id: header.id,
          handler: header.payload.handler,
        },
      }),
      Effect.annotateLogs({
        id: header.id,
        handler: header.payload.handler,
      }),
    );

const makeEventServiceFromHeader = (
  request: Request,
  header: Header.Header,
  pullEffect: {
    effect: MsgpackPullEffect;
    scope: Scope.CloseableScope;
  },
) =>
  pipe(
    header.payload,
    Schema.decodeUnknown(
      Schema.Struct({
        token: Schema.optional(Schema.String),
      }),
    ),
    Effect.catchTag("ParseError", () => Effect.succeed({ token: undefined })),
    Effect.flatMap((payload) =>
      makeEventService({
        request,
        pullEffect,
        token: pipe(
          Option.fromNullable(payload.token),
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
    Effect.withSpan("Server.makeEventServiceFromHeader", {
      captureStackTrace: true,
      attributes: {
        id: header.id,
      },
    }),
    Effect.annotateLogs({
      id: header.id,
    }),
  );

const makeHeaderAndEventServiceFromPullStream = (
  request: Request,
  pullEffect: {
    effect: MsgpackPullEffect;
    scope: Scope.CloseableScope;
  },
) =>
  pipe(
    pullEffect.effect,
    Effect.flatMap(Schema.decodeUnknown(Header.HeaderSchema)),
    Effect.option,
    Effect.flatMap(
      Effect.transposeMapOption((header) =>
        pipe(
          makeEventServiceFromHeader(request, header, pullEffect),
          Effect.map((event) => ({ header, event })),
        ),
      ),
    ),
    Effect.withSpan("Server.makeHeaderAndEventServiceFromPullStream", {
      captureStackTrace: true,
    }),
  );

const applySpanLink = (span: Tracer.Span, linkSpan: Tracer.AnySpan) =>
  Effect.sync(() =>
    span.addLinks([{ _tag: "SpanLink", span: linkSpan, attributes: {} }]),
  );

const applyExternalSpanLink = (
  span: Tracer.Span,
  externalSpan?: { traceId: string; spanId: string },
) =>
  externalSpan
    ? applySpanLink(span, Tracer.externalSpan(externalSpan))
    : Effect.void;

const sendPeerBuffer = (peer: Peer) => (buffer: Uint8Array) =>
  pipe(
    Effect.sync(() => peer.send(buffer, { compress: true })),
    Effect.withSpan("Server.sendPeerBuffer", {
      captureStackTrace: true,
    }),
  );

const handleProtocolWebSocketMessage =
  (peer: Peer, message: Message, span: Tracer.Span) =>
  <R = never>(serverWithRuntime: ServerWithRuntime<R>) =>
    pipe(
      Effect.Do,
      Effect.bind("scope", () => Scope.make()),
      Effect.let("blob", () => message.blob()),
      Effect.bind("pullEffect", ({ scope, blob }) =>
        pipe(
          Msgpack.Decoder.blobToStream(blob),
          Stream.toPullEffect,
          Scope.extend(scope),
        ),
      ),
      Effect.flatMap(({ pullEffect, scope }) =>
        makeHeaderAndEventServiceFromPullStream(peer.request, {
          effect: pullEffect,
          scope,
        }),
      ),
      Effect.flatMap(
        Option.match({
          onSome: ({ header, event }) =>
            pipe(
              applyExternalSpanLink(span, header.span),
              Effect.andThen(() =>
                pipe(
                  serverWithRuntime,
                  pipe(
                    Match.value(header),
                    Match.when(
                      { action: "client:subscribe" },
                      (header) => handleSubscribe(peer, header, span)<R>,
                    ),
                    Match.when(
                      { action: "client:unsubscribe" },
                      (header) => handleUnsubscribe(peer, header, span)<R>,
                    ),
                    Match.when(
                      { action: "client:once" },
                      (header) =>
                        handleOnce(header, sendPeerBuffer(peer), span)<R>,
                    ),
                    Match.when(
                      { action: "client:mutate" },
                      (header) =>
                        handleMutate(header, sendPeerBuffer(peer), span)<R>,
                    ),
                    Match.orElse(() => () => Effect.void),
                  ),
                  Effect.provideService(Event, event),
                ),
              ),
            ),
          onNone: () => Effect.void,
        }),
      ),
      Effect.withSpan("Server.handleWebSocketMessage", {
        captureStackTrace: true,
      }),
    );

const returnBufferSuccess = (buffer: Uint8Array) =>
  pipe(
    Effect.sync(
      () =>
        new Response(buffer as unknown as BodyInit, {
          status: 200,
          headers: {
            "content-type": "application/octet-stream",
          },
        }),
    ),
    Effect.withSpan("Server.returnSuccessBuffer", {
      captureStackTrace: true,
    }),
  );

const returnNotFoundError = () =>
  pipe(
    Effect.sync(() => new Response("", { status: 404 })),
    Effect.withSpan("Server.returnNotFoundError", {
      captureStackTrace: true,
    }),
  );

const returnInvalidHeaderError = () =>
  pipe(
    Effect.sync(() => new Response(invalidHeaderErrorHtml, { status: 400 })),
    Effect.withSpan("Server.returnInvalidHeaderError", {
      captureStackTrace: true,
    }),
  );

const handleProtocolWebRequest =
  (request: Request, span: Tracer.Span) =>
  <R = never>(serverWithRuntime: ServerWithRuntime<R>) =>
    pipe(
      Effect.Do,
      Effect.bind("scope", () => Scope.make()),
      Effect.bind("blob", () => Effect.promise(() => request.blob())),
      Effect.bind("pullEffect", ({ blob, scope }) =>
        pipe(
          Msgpack.Decoder.blobToStream(blob),
          Stream.toPullEffect,
          Scope.extend(scope),
        ),
      ),
      Effect.flatMap(({ pullEffect, scope }) =>
        makeHeaderAndEventServiceFromPullStream(request, {
          effect: pullEffect,
          scope,
        }),
      ),
      Effect.flatMap(
        Option.match({
          onSome: ({ header, event }) =>
            pipe(
              applyExternalSpanLink(span, header.span),
              Effect.andThen(() =>
                pipe(
                  serverWithRuntime,
                  pipe(
                    Match.value(header),
                    Match.when(
                      { action: "client:once" },
                      (header) =>
                        handleOnce(header, returnBufferSuccess, span)<R>,
                    ),
                    Match.when(
                      { action: "client:mutate" },
                      (header) =>
                        handleMutate(header, returnBufferSuccess, span)<R>,
                    ),
                    Match.orElse(() => returnNotFoundError),
                  ),
                  Effect.provideService(Event, event),
                ),
              ),
            ),
          onNone: returnInvalidHeaderError,
        }),
      ),
      Effect.withSpan("Server.handleProtocolWebRequest", {
        captureStackTrace: true,
      }),
    );

const handleWebRequest =
  (request: Request, span: Tracer.Span) =>
  <R = never>(serverWithRuntime: ServerWithRuntime<R>) =>
    pipe(
      serverWithRuntime,
      pipe(
        Match.value(withoutTrailingSlash(parseURL(request.url).pathname)),
        Match.when(
          "/live",
          () =>
            handleLive((live) =>
              Effect.sync(() => new Response("", { status: live ? 200 : 500 })),
            )<R>,
        ),
        Match.when(
          "/ready",
          () =>
            handleReady((ready) =>
              Effect.sync(
                () => new Response("", { status: ready ? 200 : 500 }),
              ),
            )<R>,
        ),
        Match.orElse(() => handleProtocolWebRequest(request, span)<R>),
      ),
    );

const isStarted = <R = never>(serverWithRuntime: ServerWithRuntime<R>) =>
  pipe(
    serverWithRuntime.server.runState,
    RunState.status,
    Effect.map((status) => Array.contains(["pending", "ready"], status)),
  );

const isReady = <R = never>(serverWithRuntime: ServerWithRuntime<R>) =>
  pipe(
    serverWithRuntime.server.runState,
    RunState.status,
    Effect.map((status) => String.Equivalence(status, "ready")),
  );

const handleLive =
  <A = never, E = never, R1 = never>(
    callback: (live: boolean) => Effect.Effect<A, E, R1>,
  ) =>
  <R2 = never>(serverWithRuntime: ServerWithRuntime<R2>) =>
    pipe(serverWithRuntime, isStarted, Effect.flatMap(callback));

const handleReady =
  <A = never, E = never, R1 = never>(
    callback: (ready: boolean) => Effect.Effect<A, E, R1>,
  ) =>
  <R2 = never>(serverWithRuntime: ServerWithRuntime<R2>) =>
    pipe(
      Effect.Do,
      Effect.bindAll(
        () => ({
          start: isStarted(serverWithRuntime),
          ready: isReady(serverWithRuntime),
        }),
        { concurrency: "unbounded" },
      ),
      Effect.map(({ start, ready }) => Boolean.and(start, ready)),
      Effect.flatMap(callback),
    );

const transformErrorResult = <A = never, E = never, R = never>(
  onError: (error: Cause.Cause<E>) => Effect.Effect<A, never, never>,
) => {
  return (effect: Effect.Effect<A, E, R>) =>
    pipe(
      effect,
      Effect.exit,
      Effect.flatMap(
        Exit.match({
          onSuccess: (response) => Effect.succeed(response),
          onFailure: (cause) =>
            pipe(
              Effect.Do,
              Effect.let("pretty", () =>
                Cause.pretty(cause, { renderErrorCause: true }),
              ),
              Effect.tap(({ pretty }) => Effect.log(pretty)),
              Effect.flatMap(() => onError(cause)),
            ),
        }),
      ),
      Effect.withSpan("serve.transformErrorResult", {
        captureStackTrace: true,
      }),
    );
};

export const start = <R = never>(
  server: Server<R>,
  runtime: Runtime.Runtime<R>,
) =>
  pipe(
    server.runState,
    RunState.start(server, runtime),
    Effect.tap(() => Effect.log("Server is ready")),
    Effect.as(server),
  );

export const stop = <R = never>(
  server: Server<R>,
  runtime: Runtime.Runtime<R>,
) =>
  pipe(
    server.runState,
    RunState.stop(server, runtime),
    Effect.tap(() => Effect.log("Server is stopped")),
    Effect.as(server),
  );
