import { Data, Effect, Option, pipe, Schema, SynchronizedRef } from "effect";
import { ofetch } from "ofetch";
import { Handler } from "typhoon-core/server";
import { Header, Msgpack, Stream } from "typhoon-core/protocol";
import { Validate, Validator } from "typhoon-core/validator";

export class HandlerError extends Data.TaggedError("HandlerError")<{
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
      Effect.bind("requestHeader", ({ id, token }) =>
        Schema.encode(Header.HeaderSchema)({
          protocol: "typh",
          version: 1,
          id,
          action: "client:once",
          payload: {
            handler: handler,
            token: Option.getOrUndefined(token),
          },
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
      Effect.bind("blob", ({ requestBuffer }) =>
        Effect.tryPromise(() =>
          ofetch(client.url, {
            method: "POST",
            body: requestBuffer,
            responseType: "blob",
          }),
        ),
      ),
      Effect.bind("pullStream", ({ blob }) =>
        pipe(Msgpack.Decoder.blobToStream(blob), Stream.toPullStream),
      ),
      Effect.bind("header", ({ pullStream }) =>
        pipe(
          pullStream,
          Effect.flatMap(
            Validate.validate(
              pipe(Header.HeaderSchema, Schema.standardSchemaV1),
            ),
          ),
        ),
      ),
      // TODO: check if the response is a valid header
      Effect.bind("decodedResponse", ({ pullStream }) => pullStream),
      Effect.bind("config", () =>
        Handler.Config.Collection.getHandlerConfig(
          "subscription",
          handler,
        )(client.configCollection),
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
                Effect.fail(new HandlerError({ cause: error })),
              ),
            )
          : Effect.fail(new HandlerError({ cause: decodedResponse })),
      ),
      Effect.scoped,
      Effect.withSpan("HttpClient.once", {
        captureStackTrace: true,
      }),
    );
  }
}
