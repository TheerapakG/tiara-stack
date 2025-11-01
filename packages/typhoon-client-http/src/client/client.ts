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
import { makeMissingRpcConfigError, makeRpcError } from "typhoon-core/error";
import { FromStandardSchemaV1 } from "typhoon-core/schema";
import { Handler } from "typhoon-core/server";
import { Header, Msgpack, Stream } from "typhoon-core/protocol";
import { Validate, Validator } from "typhoon-core/validator";

export class HttpClient<
  SubscriptionHandlerConfigs extends Record<
    string,
    Handler.Config.Subscription.SubscriptionHandlerConfig
  > = Record<string, Handler.Config.Subscription.SubscriptionHandlerConfig>,
  MutationHandlerConfigs extends Record<
    string,
    Handler.Config.Mutation.MutationHandlerConfig
  > = Record<string, Handler.Config.Mutation.MutationHandlerConfig>,
> {
  constructor(
    private readonly url: string,
    private readonly configCollection: Handler.Config.Collection.HandlerConfigCollection<
      SubscriptionHandlerConfigs,
      MutationHandlerConfigs
    >,
    private readonly token: SynchronizedRef.SynchronizedRef<
      Option.Option<string>
    >,
  ) {}

  static create<
    SubscriptionHandlerConfigs extends Record<
      string,
      Handler.Config.Subscription.SubscriptionHandlerConfig
    >,
    MutationHandlerConfigs extends Record<
      string,
      Handler.Config.Mutation.MutationHandlerConfig
    >,
  >(
    configCollection: Handler.Config.Collection.HandlerConfigCollection<
      SubscriptionHandlerConfigs,
      MutationHandlerConfigs
    >,
    url: string,
  ): Effect.Effect<
    HttpClient<SubscriptionHandlerConfigs, MutationHandlerConfigs>,
    never,
    never
  > {
    return pipe(
      Effect.Do,
      Effect.bind("token", () => SynchronizedRef.make(Option.none<string>())),
      Effect.map(
        ({ token }) =>
          new HttpClient<SubscriptionHandlerConfigs, MutationHandlerConfigs>(
            url,
            configCollection,
            token,
          ),
      ),
      Effect.withSpan("HttpClient.create", {
        captureStackTrace: true,
      }),
    );
  }

  static token =
    (token: Option.Option<string>) =>
    (
      client: HttpClient<
        Record<string, Handler.Config.Subscription.SubscriptionHandlerConfig>,
        Record<string, Handler.Config.Mutation.MutationHandlerConfig>
      >,
    ) =>
      pipe(
        SynchronizedRef.update(client.token, () => token),
        Effect.withSpan("HttpClient.token", {
          captureStackTrace: true,
        }),
      );

  static once<
    SubscriptionHandlerConfigs extends Record<
      string,
      Handler.Config.Subscription.SubscriptionHandlerConfig
    >,
    Handler extends keyof SubscriptionHandlerConfigs & string,
  >(
    client: HttpClient<
      SubscriptionHandlerConfigs,
      Record<string, Handler.Config.Mutation.MutationHandlerConfig>
    >,
    handler: Handler,
    // TODO: make this conditionally optional
    data?: Validator.Input<
      Handler.Config.ResolvedRequestParamsValidator<
        Handler.Config.RequestParamsOrUndefined<
          SubscriptionHandlerConfigs[Handler]
        >
      >
    >,
  ) {
    return pipe(
      Effect.Do,
      Effect.let("config", () =>
        pipe(
          Handler.Config.Collection.getHandlerConfig(
            "subscription",
            handler,
          )(client.configCollection),
          Option.getOrThrowWith(() =>
            makeMissingRpcConfigError(
              `Failed to get handler config for ${handler}`,
            ),
          ),
        ),
      ),
      Effect.let("responseErrorValidator", ({ config }) =>
        pipe(
          Handler.Config.resolveResponseErrorValidator(
            Handler.Config.responseError(config),
          ),
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
        ({ header, decodedResponse, config, responseErrorValidator }) =>
          pipe(
            decodedResponse,
            Either.liftPredicate(
              () => header.action === "server:update" && header.payload.success,
              Function.identity,
            ),
            Handler.Config.decodeResponseUnknown(config),
            Effect.map(
              Either.mapLeft((error) =>
                makeRpcError(
                  (responseErrorValidator === undefined
                    ? Schema.Unknown
                    : FromStandardSchemaV1(
                        responseErrorValidator,
                      )) as Schema.Schema<
                    Validator.Output<
                      Handler.Config.ResolvedResponseErrorValidator<
                        Handler.Config.ResponseErrorOrUndefined<
                          SubscriptionHandlerConfigs[Handler]
                        >
                      >
                    >,
                    Validator.Input<
                      Handler.Config.ResolvedResponseErrorValidator<
                        Handler.Config.ResponseErrorOrUndefined<
                          SubscriptionHandlerConfigs[Handler]
                        >
                      >
                    >
                  >,
                )(
                  typeof error === "object" &&
                    error !== null &&
                    "message" in error &&
                    typeof error.message === "string"
                    ? error.message
                    : "An unknown error occurred",
                  error,
                ),
              ),
            ),
            Effect.flatten,
          ),
      ),
      Effect.scoped,
      Effect.withSpan("HttpClient.once", {
        captureStackTrace: true,
      }),
    );
  }
}
