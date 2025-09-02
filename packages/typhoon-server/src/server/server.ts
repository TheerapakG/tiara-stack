import { Message, Peer } from "crossws";
import type { serve as crosswsServe } from "crossws/server";
import {
  Cause,
  Context,
  Data,
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
  SynchronizedRef,
} from "effect";
import {
  Header,
  HeaderEncoderDecoder,
  MsgpackDecodeError,
  MsgpackEncoderDecoder,
  StreamExhaustedError,
} from "typhoon-core/protocol";
import { Server as BaseServer, ServerSymbol } from "typhoon-core/server";
import { Computed, computed, effect, observeOnce } from "typhoon-core/signal";
import { MutationHandlerConfig, SubscriptionHandlerConfig } from "../config";
import { Event } from "./event";
import {
  AnyMutationHandlerContext,
  AnySubscriptionHandlerContext,
  MutationHandlerContext,
  SubscriptionHandlerContext,
} from "./handler";
import invalidHeaderErrorHtml from "./invalidHeaderError.html";

type SubscriptionHandlerMap<R> = HashMap.HashMap<
  string,
  SubscriptionHandlerContext<SubscriptionHandlerConfig, R>
>;
type MutationHandlerMap<R> = HashMap.HashMap<
  string,
  MutationHandlerContext<MutationHandlerConfig, R>
>;

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
    R = never,
    SubscriptionHandlers extends Record<
      string,
      AnySubscriptionHandlerContext
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    > = {},
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    MutationHandlers extends Record<string, AnyMutationHandlerContext> = {},
  >
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
  implements BaseServer<SubscriptionHandlers, MutationHandlers>
{
  readonly [ServerSymbol]: BaseServer<SubscriptionHandlers, MutationHandlers> =
    this;

  static create<R = never>(layer: Layer.Layer<R, unknown>) {
    return pipe(
      Effect.Do,
      Effect.bindAll(
        () => ({
          traceProvider: Effect.succeed(Layer.empty),
          subscriptionHandlerMap: Effect.succeed(
            HashMap.empty<
              string,
              SubscriptionHandlerContext<SubscriptionHandlerConfig, R>
            >(),
          ),
          mutationHandlerMap: Effect.succeed(
            HashMap.empty<
              string,
              MutationHandlerContext<MutationHandlerConfig, R>
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
      Effect.map(
        (params) =>
          // eslint-disable-next-line @typescript-eslint/no-empty-object-type
          new Server<R, {}, {}>(params),
      ),
    );
  }

  static withTraceProvider(traceProvider: Layer.Layer<never>) {
    return <
      R = never,
      SubscriptionHandlers extends Record<
        string,
        SubscriptionHandlerContext
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      > = {},
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      MutationHandlers extends Record<string, MutationHandlerContext> = {},
    >(
      server: Server<R, SubscriptionHandlers, MutationHandlers>,
    ): Server<R, SubscriptionHandlers, MutationHandlers> => {
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
      R = never,
      SubscriptionHandlers extends Record<
        string,
        SubscriptionHandlerContext
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      > = {},
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      MutationHandlers extends Record<string, MutationHandlerContext> = {},
    >(
      server: Server<R, SubscriptionHandlers, MutationHandlers>,
    ): [Handler] extends [AnySubscriptionHandlerContext]
      ? Server<
          R,
          SubscriptionHandlers & {
            [K in Handler["config"]["name"]]: Handler;
          },
          MutationHandlers
        >
      : [Handler] extends [AnyMutationHandlerContext]
        ? Server<
            R,
            SubscriptionHandlers,
            MutationHandlers & { [K in Handler["config"]["name"]]: Handler }
          >
        : never => {
      const newHandlerMaps = pipe(
        Match.value(handler.config),
        Match.when({ type: "subscription" }, () => ({
          subscriptionHandlerMap: HashMap.set(
            server.subscriptionHandlerMap,
            handler.config.name,
            handler as SubscriptionHandlerContext,
          ),
          mutationHandlerMap: server.mutationHandlerMap,
        })),
        Match.when({ type: "mutation" }, () => ({
          subscriptionHandlerMap: server.subscriptionHandlerMap,
          mutationHandlerMap: HashMap.set(
            server.mutationHandlerMap,
            handler.config.name,
            handler as MutationHandlerContext,
          ),
        })),
        Match.orElseAbsurd,
      );

      return new Server({
        ...server,
        ...newHandlerMaps,
      }) as unknown as [Handler] extends [AnySubscriptionHandlerContext]
        ? Server<
            R,
            SubscriptionHandlers & {
              [K in Handler["config"]["name"]]: Handler;
            },
            MutationHandlers
          >
        : [Handler] extends [AnyMutationHandlerContext]
          ? Server<
              R,
              SubscriptionHandlers,
              MutationHandlers & { [K in Handler["config"]["name"]]: Handler }
            >
          : never;
    };
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subscriptionHandlerContext: SubscriptionHandlerContext<any, R>,
    nonce: Nonce,
  ): Effect.Effect<
    Computed<
      {
        header: Header<"server:update">;
        message: Uint8Array;
      },
      never,
      Event | R
    >,
    unknown,
    never
  > {
    return pipe(
      subscriptionHandlerContext.handler,
      Effect.flatMap((handler) =>
        computed(
          pipe(
            Effect.Do,
            Effect.bind("value", () => Effect.exit(handler)),
            Effect.bind("nonce", () => Nonce.getAndIncrement(nonce)),
            Effect.let(
              "header",
              ({ value, nonce }) =>
                ({
                  protocol: "typh",
                  version: 1,
                  id: subscriptionId,
                  action: "server:update",
                  payload: {
                    success: Exit.isSuccess(value),
                    nonce,
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
            }),
            Effect.annotateLogs({
              handler: subscriptionHandlerContext.config.name,
            }),
          ),
        ),
      ),
      Effect.withSpan("Server.getComputedSubscriptionResult", {
        captureStackTrace: true,
      }),
      Effect.annotateLogs({
        handler: subscriptionHandlerContext.config.name,
      }),
    );
  }

  private static getComputedSubscriptionResultEncoded<R = never>(
    subscriptionId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subscriptionHandlerContext: SubscriptionHandlerContext<any, R>,
    nonce: Nonce,
  ) {
    return pipe(
      Server.getComputedSubscriptionResult(
        subscriptionId,
        subscriptionHandlerContext,
        nonce,
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
                  onSome: ({ event, effectCleanup, nonce }) =>
                    pipe(
                      Event.replaceStreamContext({
                        pullStream: pullDecodedStream,
                        request: peer.request,
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
                          request: peer.request,
                          scope,
                        }),
                      ),
                      Effect.bind("handlerContext", () =>
                        HashMap.get(
                          server.subscriptionHandlerMap,
                          header.payload.handler,
                        ),
                      ),
                      Effect.bind("nonce", () => Nonce.make()),
                      Effect.bind(
                        "computedBuffer",
                        ({ handlerContext, nonce }) =>
                          Server.getComputedSubscriptionResultEncoded(
                            header.id,
                            handlerContext,
                            nonce,
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
        Effect.let("event", () =>
          Event.fromPullStreamContext({
            pullStream: pullDecodedStream,
            request,
            scope,
          }),
        ),
        Effect.bind("handlerContext", () =>
          HashMap.get(server.subscriptionHandlerMap, header.payload.handler),
        ),
        Effect.bind("nonce", () => Nonce.make()),
        Effect.bind("computedBuffer", ({ handlerContext, nonce }) =>
          Server.getComputedSubscriptionResultEncoded(
            header.id,
            handlerContext,
            nonce,
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
    callback: Effect.Effect<A, E, Event>,
    scope: Scope.CloseableScope,
  ) {
    return <R = never>(server: Server<R>) =>
      pipe(
        Effect.Do,
        Effect.tap(() => server.mutationTotal(Effect.succeed(BigInt(1)))),
        Effect.let("event", () =>
          Event.fromPullStreamContext({
            pullStream: pullDecodedStream,
            request,
            scope,
          }),
        ),
        Effect.bind("handlerContext", () =>
          HashMap.get(server.mutationHandlerMap, header.payload.handler),
        ),
        Effect.bind("returnValue", ({ event, handlerContext }) =>
          pipe(
            Effect.Do,
            Effect.bind("runtime", () => SynchronizedRef.get(server.runtime)),
            Effect.flatMap(({ runtime }) =>
              pipe(
                runtime,
                Option.match({
                  onSome: (runtime) =>
                    pipe(handlerContext.handler, Effect.provide(runtime)),
                  onNone: () => Effect.fail("scope layer not initialized"),
                }),
              ),
            ),
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
                      Effect.void,
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
                      Effect.sync(() => new Response("", { status: 200 })),
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
  <
    R,
    SubscriptionHandlers extends Record<
      string,
      AnySubscriptionHandlerContext<SubscriptionHandlerConfig, R>
    >,
    MutationHandlers extends Record<
      string,
      AnyMutationHandlerContext<MutationHandlerConfig, R>
    >,
  >(
    serveFn: typeof crosswsServe,
  ) =>
  (server: Server<R, SubscriptionHandlers, MutationHandlers>) => {
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

export type InferServerType<E extends Effect.Effect<unknown, unknown, never>> =
  E extends Effect.Effect<infer S, unknown, never>
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      S extends Server<any, infer SubscriptionHandlers, infer MutationHandlers>
      ? BaseServer<SubscriptionHandlers, MutationHandlers>
      : never
    : never;
