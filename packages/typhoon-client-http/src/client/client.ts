import { HttpClient as EffectHttpClient, HttpBody } from "@effect/platform";
import {
  Effect,
  Either,
  Option,
  pipe,
  Schema,
  SynchronizedRef,
  Tracer,
  Function,
} from "effect";
import {
  MissingRpcConfigError,
  RpcError,
  ValidationError,
} from "typhoon-core/error";
import { Data as CoreData } from "typhoon-core/handler";
import { Handler } from "typhoon-core/server";
import { Data as HandlerData } from "typhoon-server/handler";
import { Header, Msgpack, Stream } from "typhoon-core/protocol";
import { Validate, Validator } from "typhoon-core/validator";

export const HandlerDataGroupTypeId = CoreData.Group.HandlerDataGroupTypeId;
export const HandlerDataCollectionTypeId =
  CoreData.Collection.HandlerDataCollectionTypeId;

export class HttpClient<
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
  ): Effect.Effect<HttpClient<Collection>, never, never> {
    return pipe(
      Effect.Do,
      Effect.bind("token", () => SynchronizedRef.make(Option.none<string>())),
      Effect.map(
        ({ token }) =>
          new HttpClient<Collection>(url, handlerDataCollection, token),
      ),
      Effect.withSpan("HttpClient.create", {
        captureStackTrace: true,
      }),
    );
  }

  static token =
    (token: Option.Option<string>) =>
    (client: HttpClient<HandlerData.Collection.HandlerDataCollection<any>>) =>
      pipe(
        SynchronizedRef.update(client.token, () => token),
        Effect.withSpan("HttpClient.token", {
          captureStackTrace: true,
        }),
      );

  static once<
    const Collection extends
      HandlerData.Collection.HandlerDataCollection<HandlerData.Collection.BaseHandlerDataCollectionRecord>,
    H extends keyof HandlerData.Group.Subscription.GetHandlerDataGroupRecord<
      HandlerData.Collection.GetHandlerDataGroup<Collection, "subscription">
    > &
      string,
    HData extends HandlerData.Group.Subscription.GetHandlerData<
      HandlerData.Collection.GetHandlerDataGroup<Collection, "subscription">,
      H
    > = HandlerData.Group.Subscription.GetHandlerData<
      HandlerData.Collection.GetHandlerDataGroup<Collection, "subscription">,
      H
    >,
  >(
    client: HttpClient<Collection>,
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
      Effect.let("config", () =>
        pipe(
          client.handlerDataCollection,
          HandlerData.Collection.getHandlerDataGroup("subscription"),
          Option.getOrThrowWith(() =>
            MissingRpcConfigError.make({
              message: `Failed to get handler config for ${handler}`,
            }),
          ),
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
      Effect.let("id", () => crypto.randomUUID() as string),
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
      Effect.bind("stream", ({ requestBuffer }) =>
        pipe(
          EffectHttpClient.post(client.url, {
            body: HttpBody.uint8Array(
              requestBuffer,
              "application/octet-stream",
            ),
          }),
          Effect.map((response) => response.stream),
        ),
      ),
      Effect.bind("pullEffect", ({ stream }) =>
        pipe(Msgpack.Decoder.streamToStream(stream), Stream.toPullEffect),
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
      Effect.flatMap(
        ({ header, decodedResponse, config }) =>
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
          ) as Effect.Effect<
            Validator.Output<
              Handler.Config.ResolvedResponseValidator<
                Handler.Config.ResponseOrUndefined<HData>
              >
            >,
            | RpcError<
                Validator.Output<
                  Handler.Config.ResolvedResponseErrorValidator<
                    Handler.Config.ResponseErrorOrUndefined<HData>
                  >
                >
              >
            | ValidationError
          >,
      ),
      Effect.scoped,
      Effect.withSpan("HttpClient.once", {
        captureStackTrace: true,
      }),
    );
  }
}
