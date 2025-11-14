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
import { Header, Msgpack, Stream } from "typhoon-core/protocol";
import { Validate, Validator } from "typhoon-core/validator";
import { makeMissingRpcConfigError, makeRpcError } from "typhoon-core/error";
import { FromStandardSchemaV1 } from "typhoon-core/schema";

export class HandlerError extends Data.TaggedError("HandlerError")<{
  message: string;
  cause: unknown;
}> {}

export class AppsScriptClient<
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
    const Collection extends Handler.Config.Collection.HandlerConfigCollection<
      any,
      any
    >,
  >(
    configCollection: Collection,
    url: string,
  ): Effect.Effect<
    AppsScriptClient<
      Handler.Config.Collection.HandlerConfigCollectionSubscriptionHandlerConfigs<Collection>,
      Handler.Config.Collection.HandlerConfigCollectionMutationHandlerConfigs<Collection>
    >,
    never,
    never
  > {
    return pipe(
      Effect.Do,
      Effect.bind("token", () => SynchronizedRef.make(Option.none<string>())),
      Effect.map(
        ({ token }) =>
          new AppsScriptClient<
            Handler.Config.Collection.HandlerConfigCollectionSubscriptionHandlerConfigs<Collection>,
            Handler.Config.Collection.HandlerConfigCollectionMutationHandlerConfigs<Collection>
          >(url, configCollection, token),
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
        Record<string, Handler.Config.Subscription.SubscriptionHandlerConfig>,
        Record<string, Handler.Config.Mutation.MutationHandlerConfig>
      >,
    ) =>
      pipe(
        SynchronizedRef.update(client.token, () => token),
        Effect.withSpan("AppsScriptClient.token", {
          captureStackTrace: true,
        }),
      );

  static once<
    SubscriptionHandlerConfigs extends Record<
      string,
      Handler.Config.Subscription.SubscriptionHandlerConfig
    >,
    H extends keyof SubscriptionHandlerConfigs & string,
  >(
    client: AppsScriptClient<
      SubscriptionHandlerConfigs,
      Record<string, Handler.Config.Mutation.MutationHandlerConfig>
    >,
    handler: H,
    // TODO: make this conditionally optional
    data?: Validator.Input<
      Handler.Config.ResolvedRequestParamsValidator<
        Handler.Config.RequestParamsOrUndefined<SubscriptionHandlerConfigs[H]>
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
      Effect.let("response", ({ requestBuffer }) =>
        UrlFetchApp.fetch(client.url, {
          method: "post",
          contentType: "application/octet-stream",
          payload: requestBuffer,
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
                          SubscriptionHandlerConfigs[H]
                        >
                      >
                    >,
                    Validator.Input<
                      Handler.Config.ResolvedResponseErrorValidator<
                        Handler.Config.ResponseErrorOrUndefined<
                          SubscriptionHandlerConfigs[H]
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
      Effect.withSpan("AppsScriptClient.once"),
    );
  }
}
