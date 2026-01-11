import type { Message, Peer } from "crossws";
import type { serve as crosswsServe } from "crossws/server";
import {
  Array,
  Boolean,
  Cause,
  Context,
  Data,
  DateTime,
  Deferred,
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
import { UntilObserver, SideEffect, SignalService } from "typhoon-core/signal";
import { parseURL, withoutTrailingSlash } from "ufo";
import {
  close as closeEvent,
  handler as eventHandler,
  Event,
  makeEventService,
  type MsgpackPullEffect,
  pullEffect as eventPullEffect,
  replacePullStream,
} from "@/event/event";
import { type HandlerContextCollection } from "../handler/context/collection";
import { Context as HandlerContextCore } from "typhoon-core/handler";
import { type MutationHandlerT } from "../handler/mutation/type";
import { type SubscriptionHandlerT } from "../handler/subscription/type";
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

type MutationWithMetricsContext<R> = {
  id: string;
  span: Tracer.Span;
  sendClientBuffer: (buffer: Uint8Array) => Effect.Effect<unknown, unknown, R | Event>;
  serverWithRuntime: ServerWithRuntime<R>;
};

type SubscriptionOnceWithMetricsContext<R> = {
  operation: "once";
  id: string;
  span: Tracer.Span;
  sendClientBuffer: (buffer: Uint8Array) => Effect.Effect<unknown, unknown, R | Event>;
  serverWithRuntime: ServerWithRuntime<R>;
};

type SubscriptionWithMetricsContext<R> =
  | SubscriptionOnceWithMetricsContext<R>
  | SubscriptionSubscribeWithMetricsContext<R>;

type SubscriptionSubscribeWithMetricsContext<R> = {
  operation: "subscribe";
  subscriptionState: SubscriptionState;
  id: string;
  span: Tracer.Span;
  sendClientBuffer: (buffer: Uint8Array) => Effect.Effect<void, never, never>;
  serverWithRuntime: ServerWithRuntime<R>;
};

interface MutationWithMetricsContextT extends HandlerContext.Type.WithMetricsExecutorTypeLambda {
  readonly context: MutationWithMetricsContext<this["R"]>;
  readonly result: Effect.Effect<void, never, Event>;
}

interface SubscriptionWithMetricsContextT
  extends HandlerContext.Type.WithMetricsExecutorTypeLambda {
  readonly context: SubscriptionWithMetricsContext<this["R"]>;
  readonly result: Effect.Effect<void, never, Event>;
}

type ServerWithMetricsContextTRecord = {
  mutation: MutationWithMetricsContextT;
  subscription: SubscriptionWithMetricsContextT;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServerContext<S extends Server<any>> = S extends Server<infer R> ? R : never;

interface ServerRunStateContextTypeLambda extends RunState.RunStateContextTypeLambda {
  readonly type: Server<Exclude<this["R"], SignalService.SignalService>>;
}

type ServerData<R = never> = {
  traceProvider: Layer.Layer<never>;
  handlerContextCollection: HandlerContextCore.CollectionWithMetrics.HandlerContextCollectionWithMetrics<
    MutationHandlerT | SubscriptionHandlerT,
    ServerWithMetricsContextTRecord,
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
    Cause.UnknownException,
    SignalService.SignalService
  >;
};

export class Server<R = never> extends Data.TaggedClass("Server")<ServerData<R>> {}

export class ServerWithRuntime<R = never> extends Data.TaggedClass("ServerWithRuntime")<{
  server: Server<R>;
  runtime: Runtime.Runtime<R | SignalService.SignalService>;
}> {}

const makeServeEffect =
  (serveFn: typeof crosswsServe) =>
  <R = never>(server: Server<R>, runtime: Runtime.Runtime<R | SignalService.SignalService>) =>
    pipe(
      Effect.Do,
      Effect.let("serverWithRuntime", () => new ServerWithRuntime({ server, runtime })),
      Effect.tap(() =>
        HandlerContextCore.CollectionWithMetrics.initialize(server.handlerContextCollection),
      ),
      Effect.flatMap(({ serverWithRuntime }) =>
        Effect.try(() =>
          serveFn({
            websocket: {
              open: (peer) => {
                return pipe(
                  serverWithRuntime,
                  open(peer),
                  transformErrorResult(() => Effect.void),
                  Effect.withSpan("serve.websocket.open", {
                    captureStackTrace: true,
                  }),
                  Effect.provide(server.traceProvider),
                  Runtime.runPromise(runtime),
                );
              },

              message: (peer, message) => {
                return pipe(
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
                  Runtime.runPromise(runtime),
                );
              },

              close: (peer, _event) => {
                return pipe(
                  serverWithRuntime,
                  close(peer),
                  transformErrorResult(() => Effect.void),
                  Effect.withSpan("serve.websocket.close", {
                    captureStackTrace: true,
                  }),
                  Runtime.runPromise(runtime),
                );
              },

              error: (peer) => {
                return pipe(
                  serverWithRuntime,
                  close(peer),
                  transformErrorResult(() => Effect.void),
                  Effect.withSpan("serve.websocket.error", {
                    captureStackTrace: true,
                  }),
                  Effect.provide(server.traceProvider),
                  Runtime.runPromise(runtime),
                );
              },
            },
            fetch: (request) => {
              return pipe(
                Effect.currentSpan,
                Effect.flatMap((span) =>
                  pipe(
                    serverWithRuntime,
                    handleWebRequest(request, span),
                    transformErrorResult(() => Effect.succeed(new Response("", { status: 500 }))),
                  ),
                ),
                Effect.withSpan("serve.fetch", {
                  captureStackTrace: true,
                }),
                Effect.provide(server.traceProvider),
                Runtime.runPromise(runtime),
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
          HandlerContextCore.CollectionWithMetrics.empty<
            MutationHandlerT | SubscriptionHandlerT,
            ServerWithMetricsContextTRecord,
            R
          >(
            {
              mutation: (config) => Handler.Config.Mutation.name(config),
              subscription: (config) => Handler.Config.Subscription.name(config),
            },
            (
              context:
                | HandlerContextCore.HandlerContext<MutationHandlerT>
                | HandlerContextCore.HandlerContext<SubscriptionHandlerT>,
            ) =>
              pipe(
                Match.value(HandlerContextCore.data(context)),
                Match.tagsExhaustive({
                  PartialMutationHandlerConfig: () => "mutation" as const,
                  PartialSubscriptionHandlerConfig: () => "subscription" as const,
                }),
              ),
            {
              mutation: (
                handler: Option.Option<Type.Handler<MutationHandlerT, unknown, unknown, R>>,
                context: MutationWithMetricsContext<R>,
              ) => runMutationHandler<R>(handler, context),
              subscription: (
                handler: Option.Option<Type.Handler<SubscriptionHandlerT, unknown, unknown, R>>,
                context: SubscriptionWithMetricsContext<R>,
              ) => runSubscriptionHandler<R>(handler, context),
            },
          ),
        ),
        peerStateMapRef: SynchronizedRef.make(HashMap.empty<string, PeerState>()),
        peerActive: Effect.succeed(
          Metric.gauge("typhoon_server_peer_active", {
            description: "The number of peers currently connected to the server",
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
        runState: RunState.make<
          ServerRunStateContextTypeLambda,
          void,
          Cause.UnknownException,
          SignalService.SignalService
        >(makeServeEffect(serveFn), () => Effect.void),
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
            collection as HandlerContextCore.CollectionWithMetrics.HandlerContextCollectionWithMetrics<
              MutationHandlerT | SubscriptionHandlerT,
              ServerWithMetricsContextTRecord,
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
      any,
      any
    >,
  >(
    handlerContextCollection: C,
  ) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <S extends Server<any>>(server: S) =>
    new Server<ServerContext<S> | HandlerContext.Collection.HandlerContextCollectionContext<C>>(
      Struct.evolve(server, {
        handlerContextCollection: (collection) =>
          HandlerContextCore.CollectionWithMetrics.addCollection(
            handlerContextCollection as HandlerContextCollection<
              HandlerContext.Collection.HandlerContextCollectionContext<C>
            >,
          )(
            collection as HandlerContextCore.CollectionWithMetrics.HandlerContextCollectionWithMetrics<
              MutationHandlerT | SubscriptionHandlerT,
              ServerWithMetricsContextTRecord,
              ServerContext<S>
            >,
          ),
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
          peerTotal: serverWithRuntime.server.peerTotal(Effect.succeed(BigInt(increment ? 1 : 0))),
        }),
        { concurrency: "unbounded" },
      ),
      Effect.withSpan("Server.updatePeerMetrics", {
        captureStackTrace: true,
      }),
    );

const updatePeerState =
  <E = never, R = never>(
    peer: Peer,
    updaterEffect: (
      state: Option.Option<PeerState>,
    ) => Effect.Effect<Option.Option<PeerState>, E, R>,
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
  <E = never, R = never>(
    subscriptionId: string,
    updaterOptions: {
      onSome: (state: SubscriptionState) => Effect.Effect<Option.Option<SubscriptionState>, E, R>;
      onNone: () => Effect.Effect<Option.Option<SubscriptionState>, E, R>;
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
            subscriptionStateMap: HashMap.modifyAt(subscriptionId, () => newSubscriptionState),
          }),
        ),
      ),
      Effect.withSpan("Server.transformPeerSubscriptionState", {
        captureStackTrace: true,
      }),
    );

const updatePeerSubscriptionState =
  <E = never, R = never>(
    peer: Peer,
    subscriptionId: string,
    updaterOptions: {
      onSome: (state: SubscriptionState) => Effect.Effect<Option.Option<SubscriptionState>, E, R>;
      onNone: () => Effect.Effect<Option.Option<SubscriptionState>, E, R>;
    },
  ) =>
  <R = never>(serverWithRuntime: ServerWithRuntime<R>) =>
    pipe(
      serverWithRuntime,
      updatePeerState(
        peer,
        Option.match({
          onSome: transformPeerSubscriptionState(subscriptionId, updaterOptions),
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
      Effect.tap((peerStateMap) => pipe(serverWithRuntime, updatePeerMetrics(peerStateMap, true))),
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
      Effect.tap((peerStateMap) => pipe(serverWithRuntime, updatePeerMetrics(peerStateMap, false))),
      Effect.asVoid,
      Effect.withSpan("Server.close", {
        captureStackTrace: true,
      }),
    );

class ServerUpdateResult extends Data.TaggedClass("ServerUpdateResult")<{
  header: Header.Header<"server:update">;
  message: unknown;
}> {}

const getServerUpdateResult =
  (id: string, span: Tracer.Span) => (result: Exit.Exit<unknown, unknown>) =>
    pipe(
      DateTime.now,
      Effect.map(
        (timestamp) =>
          new ServerUpdateResult({
            header: {
              protocol: "typh",
              version: 1,
              id,
              action: "server:update",
              payload: {
                success: Exit.isSuccess(result),
                timestamp: DateTime.toDate(timestamp),
              },
              span: {
                traceId: span.traceId,
                spanId: span.spanId,
              },
            } as const,
            message: pipe(
              result,
              Exit.match({
                onSuccess: Function.identity,
                onFailure: Cause.squash,
              }),
            ),
          }),
      ),
      Effect.withSpan("Server.getServerUpdateResult", {
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
      const updateBuffer = new Uint8Array(headerEncoded.length + messageEncoded.length);
      updateBuffer.set(headerEncoded, 0);
      updateBuffer.set(messageEncoded, headerEncoded.length);
      return updateBuffer;
    }),
    Effect.map(({ updateBuffer }) => updateBuffer),
    Effect.withSpan("Server.encodeServerUpdateResult", {
      captureStackTrace: true,
    }),
  );

const runHandler =
  (id: string, span: Tracer.Span) =>
  <R = never>(handler: Option.Option<Effect.Effect<unknown, unknown, R>>) =>
    pipe(
      handler as Option.Option<Effect.Effect<unknown, unknown, R | Event>>,
      Option.getOrElse(() =>
        pipe(
          eventHandler(),
          Effect.flatMap(
            Option.match({
              onSome: (handler) => Effect.die(`Handler ${handler} not found`),
              onNone: () => Effect.die(`Handler not found`),
            }),
          ),
        ),
      ),
      Effect.exit,
      Effect.scoped,
      Effect.flatMap(getServerUpdateResult(id, span)),
      Effect.flatMap(encodeServerUpdateResult),
      Effect.withSpan("Server.runHandler", {
        captureStackTrace: true,
      }),
    );

const runSubscriptionHandlerOnce = <R>(
  handler: Option.Option<Type.Handler<SubscriptionHandlerT, unknown, unknown, R>>,
  context: SubscriptionOnceWithMetricsContext<R>,
) =>
  pipe(
    handler,
    Effect.transposeOption,
    Effect.map(
      flow(
        runHandler(context.id, context.span),
        Effect.tap(context.sendClientBuffer),
        Effect.tap(closeEvent),
        Effect.provide(context.serverWithRuntime.runtime),
      ),
    ),
    UntilObserver.observeOnceScoped(),
    Effect.provide(context.serverWithRuntime.runtime),
    Effect.catchAllCause((cause) => Effect.logError(cause)),
    Effect.asVoid,
    Effect.withSpan("Server.runSubscriptionHandlerOnce", {
      captureStackTrace: true,
    }),
  );

const runSubscriptionHandlerSubscribe = <R>(
  handler: Option.Option<Type.Handler<SubscriptionHandlerT, unknown, unknown, R>>,
  context: SubscriptionSubscribeWithMetricsContext<R>,
) =>
  pipe(
    handler,
    Effect.transposeOption,
    Effect.map(
      flow(runHandler(context.id, context.span), Effect.provide(context.serverWithRuntime.runtime)),
    ),
    SideEffect.tapWithContext(
      context.sendClientBuffer,
      Context.make(Event, context.subscriptionState.event),
    ),
    Effect.provide(context.serverWithRuntime.runtime),
    Effect.catchAllCause((cause) => Effect.logError(cause)),
    Effect.asVoid,
    Scope.extend(context.subscriptionState.scope),
    Effect.withSpan("Server.runSubscriptionHandlerSubscribe", {
      captureStackTrace: true,
    }),
  );

const runSubscriptionHandler = <R>(
  handler: Option.Option<Type.Handler<SubscriptionHandlerT, unknown, unknown, R>>,
  context: SubscriptionWithMetricsContext<R>,
) =>
  pipe(
    Match.value(context),
    Match.when({ operation: "once" }, (context) => runSubscriptionHandlerOnce(handler, context)),
    Match.when({ operation: "subscribe" }, (context) =>
      runSubscriptionHandlerSubscribe(handler, context),
    ),
    Match.exhaustive,
  );

const runMutationHandler = <R>(
  handler: Option.Option<Type.Handler<MutationHandlerT, unknown, unknown, R>>,
  context: MutationWithMetricsContext<R>,
) =>
  pipe(
    handler,
    runHandler(context.id, context.span),
    Effect.tap(context.sendClientBuffer),
    Effect.tap(closeEvent),
    Effect.provide(context.serverWithRuntime.runtime),
    Effect.catchAllCause((cause) => Effect.logError(cause)),
    Effect.asVoid,
    Effect.withSpan("Server.runMutationHandler", {
      captureStackTrace: true,
    }),
  );

type ServerHandler = Effect.Effect<void, never, Event | SignalService.SignalService>;

const handleSubscribe =
  (peer: Peer, header: Header.Header<"client:subscribe">, span: Tracer.Span) =>
  <R = never>(serverWithRuntime: ServerWithRuntime<R>): ServerHandler =>
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
              ) as Effect.Effect<
                Option.Option<SubscriptionState>,
                never,
                Event | SignalService.SignalService
              >,
            onNone: () =>
              pipe(
                Effect.all({
                  event: Event,
                  scope: Scope.make(),
                }),
                Effect.map(({ event, scope }) => new SubscriptionState({ event, scope })),
                Effect.tap((subscriptionState) =>
                  pipe(
                    serverWithRuntime.server.handlerContextCollection,
                    HandlerContextCore.CollectionWithMetrics.execute<
                      HandlerContextCore.CollectionWithMetrics.HandlerContextCollectionWithMetrics<
                        MutationHandlerT | SubscriptionHandlerT,
                        ServerWithMetricsContextTRecord,
                        R
                      >,
                      SubscriptionHandlerT
                    >("subscription", header.payload.handler, {
                      operation: "subscribe",
                      id: header.id,
                      span,
                      sendClientBuffer: sendPeerBuffer(peer),
                      serverWithRuntime,
                      subscriptionState,
                    }),
                  ),
                ),
                Effect.map((subscriptionState) => Option.some(subscriptionState)),
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
  (peer: Peer, header: Header.Header<"client:unsubscribe">, _span: Tracer.Span) =>
  <R = never>(serverWithRuntime: ServerWithRuntime<R>): ServerHandler =>
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
  <R = never>(serverWithRuntime: ServerWithRuntime<R>): ServerHandler =>
    pipe(
      Effect.Do,
      Effect.tap(() => serverWithRuntime.server.onceTotal(Effect.succeed(BigInt(1)))),
      Effect.andThen(() =>
        pipe(
          serverWithRuntime.server.handlerContextCollection,
          HandlerContextCore.CollectionWithMetrics.execute<
            HandlerContextCore.CollectionWithMetrics.HandlerContextCollectionWithMetrics<
              MutationHandlerT | SubscriptionHandlerT,
              ServerWithMetricsContextTRecord,
              R
            >,
            SubscriptionHandlerT
          >("subscription", header.payload.handler, {
            operation: "once",
            id: header.id,
            span,
            sendClientBuffer: callback,
            serverWithRuntime,
          }),
        ),
      ),
      Effect.asVoid,
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
  <R = never>(serverWithRuntime: ServerWithRuntime<R>): ServerHandler =>
    pipe(
      Effect.Do,
      Effect.tap(() => serverWithRuntime.server.mutationTotal(Effect.succeed(BigInt(1)))),
      Effect.andThen(() =>
        pipe(
          serverWithRuntime.server.handlerContextCollection,
          HandlerContextCore.CollectionWithMetrics.execute<
            HandlerContextCore.CollectionWithMetrics.HandlerContextCollectionWithMetrics<
              MutationHandlerT | SubscriptionHandlerT,
              ServerWithMetricsContextTRecord,
              R
            >,
            MutationHandlerT
          >("mutation", header.payload.handler, {
            id: header.id,
            span,
            sendClientBuffer: callback,
            serverWithRuntime,
          }),
        ),
      ),
      Effect.asVoid,
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
        handler: Schema.optionalWith(Schema.String, { as: "Option" }),
        token: Schema.optionalWith(Schema.String, { as: "Option" }),
      }),
    ),
    Effect.catchTag("ParseError", () =>
      Effect.succeed({ handler: Option.none(), token: Option.none() }),
    ),
    Effect.flatMap((payload) =>
      makeEventService({
        handler: payload.handler,
        request,
        token: pipe(
          payload.token,
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
        pullEffect,
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
  Effect.sync(() => span.addLinks([{ _tag: "SpanLink", span: linkSpan, attributes: {} }]));

const applyExternalSpanLink = (
  span: Tracer.Span,
  externalSpan?: { traceId: string; spanId: string },
) => (externalSpan ? applySpanLink(span, Tracer.externalSpan(externalSpan)) : Effect.void);

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
        pipe(Msgpack.Decoder.blobToStream(blob), Stream.toPullEffect, Scope.extend(scope)),
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
                      (header) => handleOnce(header, sendPeerBuffer(peer), span)<R>,
                    ),
                    Match.when(
                      { action: "client:mutate" },
                      (header) => handleMutate(header, sendPeerBuffer(peer), span)<R>,
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
        pipe(Msgpack.Decoder.blobToStream(blob), Stream.toPullEffect, Scope.extend(scope)),
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
                      (header) => (serverWithRuntime: ServerWithRuntime<R>) =>
                        pipe(
                          Deferred.make<Uint8Array>(),
                          Effect.tap((deferred) =>
                            pipe(
                              serverWithRuntime,
                              handleOnce(
                                header,
                                (buffer) => Deferred.succeed(deferred, buffer),
                                span,
                              ),
                            ),
                          ),
                          Effect.andThen((deferred) => Deferred.await(deferred)),
                          Effect.flatMap(returnBufferSuccess),
                        ),
                    ),
                    Match.when(
                      { action: "client:mutate" },
                      (header) => (serverWithRuntime: ServerWithRuntime<R>) =>
                        pipe(
                          Deferred.make<Uint8Array>(),
                          Effect.tap((deferred) =>
                            pipe(
                              serverWithRuntime,
                              handleMutate(
                                header,
                                (buffer) => Deferred.succeed(deferred, buffer),
                                span,
                              ),
                            ),
                          ),
                          Effect.andThen((deferred) => Deferred.await(deferred)),
                          Effect.flatMap(returnBufferSuccess),
                        ),
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
              Effect.sync(() => new Response("", { status: ready ? 200 : 500 })),
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
  <A = never, E = never, R1 = never>(callback: (live: boolean) => Effect.Effect<A, E, R1>) =>
  <R2 = never>(serverWithRuntime: ServerWithRuntime<R2>) =>
    pipe(serverWithRuntime, isStarted, Effect.flatMap(callback));

const handleReady =
  <A = never, E = never, R1 = never>(callback: (ready: boolean) => Effect.Effect<A, E, R1>) =>
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
              Effect.let("pretty", () => Cause.pretty(cause, { renderErrorCause: true })),
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
  server: Server<Exclude<R, SignalService.SignalService>>,
  runtime: Runtime.Runtime<R | SignalService.SignalService>,
) =>
  pipe(
    server.runState,
    RunState.start(server, runtime),
    Effect.tap(() => Effect.log("Server is ready")),
    Effect.as(server),
  );

export const stop = <R = never>(
  server: Server<Exclude<R, SignalService.SignalService>>,
  runtime: Runtime.Runtime<R | SignalService.SignalService>,
) =>
  pipe(
    server.runState,
    RunState.stop(server, runtime),
    Effect.tap(() => Effect.log("Server is stopped")),
    Effect.as(server),
  );
