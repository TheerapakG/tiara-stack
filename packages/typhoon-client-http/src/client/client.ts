import { HttpClient as EffectHttpClient, HttpBody } from "@effect/platform";
import {
  Data,
  Effect,
  Option,
  pipe,
  Schema,
  SynchronizedRef,
  Tracer,
} from "effect";
import { Handler } from "typhoon-core/server";
import { Header, Msgpack, Stream } from "typhoon-core/protocol";
import { Validate, Validator } from "typhoon-core/validator";

export class HandlerError extends Data.TaggedError("HandlerError")<{
  message: string;
  cause: unknown;
}> {}

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
      // TODO: check if the response is a valid header
      Effect.bind("decodedResponse", ({ pullEffect }) => pullEffect),
      Effect.bind("config", () =>
        pipe(
          Handler.Config.Collection.getHandlerConfig(
            "subscription",
            handler,
          )(client.configCollection),
          Effect.catchAll((error) =>
            Effect.fail(
              new HandlerError({
                message: `Failed to get handler config for ${handler}`,
                cause: error,
              }),
            ),
          ),
        ),
      ),
      Effect.flatMap(({ header, decodedResponse, config }) =>
        header.action === "server:update" && header.payload.success
          ? pipe(
              decodedResponse,
              Validate.validate(
                Handler.Config.resolveResponseValidator(
                  Handler.Config.response(
                    config as SubscriptionHandlerConfigs[Handler],
                  ),
                ),
              ),
              Effect.catchAll((error) =>
                Effect.fail(
                  new HandlerError({
                    message: `Failed to validate response for ${handler}`,
                    cause: error,
                  }),
                ),
              ),
            )
          : pipe(
              decodedResponse,
              Schema.decodeUnknown(Schema.Struct({ message: Schema.String })),
              Effect.option,
              Effect.flatMap((messageOption) =>
                Effect.fail(
                  new HandlerError({
                    message: pipe(
                      messageOption,
                      Option.map((message) => message.message),
                      Option.getOrElse(() => "An unknown error occurred"),
                    ),
                    cause: decodedResponse,
                  }),
                ),
              ),
            ),
      ),
      Effect.scoped,
      Effect.withSpan("HttpClient.once", {
        captureStackTrace: true,
      }),
    );
  }
}
