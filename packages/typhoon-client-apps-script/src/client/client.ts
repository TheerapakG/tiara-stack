import {
  Data,
  Effect,
  Either,
  Function,
  Option,
  pipe,
  Schema,
  SynchronizedRef,
  Tracer,
} from "effect";
import { Handler } from "typhoon-core/server";
import { Data as CoreData } from "typhoon-core/handler";
import { Data as HandlerData, type Subscription } from "typhoon-server/handler";
import { Header, Msgpack, Stream } from "typhoon-core/protocol";
import { Validate, Validator } from "typhoon-core/validator";
import { MissingRpcConfigError, RpcError } from "typhoon-core/error";

export const HandlerDataGroupTypeId = CoreData.Group.HandlerDataGroupTypeId;
export const HandlerDataCollectionTypeId =
  CoreData.Collection.HandlerDataCollectionTypeId;

export class HandlerError extends Data.TaggedError("HandlerError")<{
  message: string;
  cause: unknown;
}> {}

export class AppsScriptClient<
  HandlerDataCollection extends
    HandlerData.Collection.HandlerDataCollection<HandlerData.Collection.BaseHandlerDataCollectionRecord>,
> {
  constructor(
    private readonly url: string,
    private readonly handlerDataCollection: HandlerDataCollection,
    private readonly token: SynchronizedRef.SynchronizedRef<
      Option.Option<string>
    >,
  ) {}

  static create<
    const Collection extends HandlerData.Collection.HandlerDataCollection<any>,
  >(
    handlerDataCollection: Collection,
    url: string,
  ): Effect.Effect<AppsScriptClient<Collection>, never, never> {
    return pipe(
      Effect.Do,
      Effect.bind("token", () => SynchronizedRef.make(Option.none<string>())),
      Effect.map(
        ({ token }) =>
          new AppsScriptClient<Collection>(url, handlerDataCollection, token),
      ),
      Effect.withSpan("AppsScriptClient.create", {
        captureStackTrace: true,
      }),
    );
  }

  static token =
    (token: Option.Option<string>) =>
    (
      client: AppsScriptClient<
        HandlerData.Collection.HandlerDataCollection<any>
      >,
    ) =>
      pipe(
        SynchronizedRef.update(client.token, () => token),
        Effect.withSpan("AppsScriptClient.token", {
          captureStackTrace: true,
        }),
      );

  static once<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Collection extends HandlerData.Collection.HandlerDataCollection<any>,
    H extends keyof HandlerData.Group.Subscription.GetHandlerDataGroupRecord<
      HandlerData.Collection.GetHandlerDataGroupOfHandlerT<
        Collection,
        Subscription.Type.SubscriptionHandlerT
      >
    > &
      string,
    HData extends HandlerData.Group.Subscription.GetHandlerData<
      HandlerData.Collection.GetHandlerDataGroupOfHandlerT<
        Collection,
        Subscription.Type.SubscriptionHandlerT
      >,
      H
    > = HandlerData.Group.Subscription.GetHandlerData<
      HandlerData.Collection.GetHandlerDataGroupOfHandlerT<
        Collection,
        Subscription.Type.SubscriptionHandlerT
      >,
      H
    >,
  >(
    client: AppsScriptClient<Collection>,
    handler: H,
    // TODO: make this conditionally optional
    data?: Validator.Input<
      Handler.Config.ResolvedRequestParamsValidator<
        Handler.Config.RequestParamsOrUndefined<HData>
      >
    >,
  ) {
    return pipe(
      Effect.Do,
      Effect.let(
        "handlerDataGroup",
        () =>
          pipe(
            client.handlerDataCollection,
            HandlerData.Collection.getHandlerDataGroup("subscription"),
            Option.getOrThrowWith(() =>
              MissingRpcConfigError.make({
                message: `Failed to get handler config for ${handler}`,
              }),
            ),
          ) as unknown as CoreData.Collection.GetHandlerDataGroupOfHandlerT<
            Collection,
            Subscription.Type.SubscriptionHandlerT
          >,
      ),
      Effect.let("config", ({ handlerDataGroup }) =>
        pipe(
          handlerDataGroup,
          HandlerData.Group.Subscription.getHandlerData(handler),
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
      Effect.let("id", () => Utilities.getUuid() as string),
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
      Effect.bind("response", ({ requestBuffer }) =>
        Effect.try({
          try: () =>
            UrlFetchApp.fetch(client.url, {
              method: "post",
              contentType: "application/octet-stream",
              payload: requestBuffer,
            }),
          catch: (error) =>
            new RpcError({
              message:
                typeof error === "object" &&
                error !== null &&
                "message" in error &&
                typeof error.message === "string"
                  ? `Failed to fetch from ${client.url}: ${error.message}`
                  : `Failed to fetch from ${client.url}: An unknown error occurred`,
              cause: error,
            }),
        }),
      ),
      Effect.let(
        "bytes",
        ({ response }) => new Uint8Array(response.getBlob().getBytes()),
      ),
      Effect.bind("pullEffect", ({ bytes }) =>
        pipe(Msgpack.Decoder.bytesToStream(bytes), Stream.toPullEffect),
      ),
      Effect.bind("header", ({ pullEffect }) =>
        pipe(
          pullEffect,
          Effect.flatMap(
            Validate.validate(
              pipe(Header.HeaderSchema, Schema.standardSchemaV1),
            ),
          ),
        ),
      ),
      Effect.tap(({ header }) =>
        header.span
          ? Effect.linkSpanCurrent(Tracer.externalSpan(header.span))
          : Effect.void,
      ),
      Effect.bind("decodedResponse", ({ pullEffect }) => pullEffect),
      Effect.flatMap(({ header, decodedResponse, config }) =>
        pipe(
          decodedResponse,
          Either.liftPredicate(
            () => header.action === "server:update" && header.payload.success,
            Function.identity,
          ),
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
        ),
      ),
      Effect.scoped,
      Effect.withSpan("AppsScriptClient.once"),
    );
  }
}
