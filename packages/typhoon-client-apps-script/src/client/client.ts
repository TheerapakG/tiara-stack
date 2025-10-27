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
import { Rpc, Validation } from "typhoon-core/error";

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
    AppsScriptClient<SubscriptionHandlerConfigs, MutationHandlerConfigs>,
    never,
    never
  > {
    return pipe(
      Effect.Do,
      Effect.bind("token", () => SynchronizedRef.make(Option.none<string>())),
      Effect.map(
        ({ token }) =>
          new AppsScriptClient<
            SubscriptionHandlerConfigs,
            MutationHandlerConfigs
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
    Handler extends keyof SubscriptionHandlerConfigs & string,
  >(
    client: AppsScriptClient<
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
      Effect.let("config", () =>
        pipe(
          Handler.Config.Collection.getHandlerConfig(
            "subscription",
            handler,
          )(client.configCollection),
          Option.getOrThrowWith(() =>
            Rpc.makeMissingRpcConfigError(
              `Failed to get handler config for ${handler}`,
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
            )
          : pipe(
              decodedResponse,
              Schema.decodeUnknown(Schema.Struct({ message: Schema.String })),
              Effect.option,
              Effect.flatMap((messageOption) =>
                Effect.fail(
                  Rpc.makeRpcError(
                    pipe(
                      messageOption,
                      Option.map((message) => message.message),
                      Option.getOrElse(() => "An unknown error occurred"),
                    ),
                    decodedResponse,
                  ) as Rpc.RpcError | Validation.ValidationError,
                ),
              ),
            ),
      ),
      Effect.scoped,
      Effect.withSpan("AppsScriptClient.once"),
    );
  }
}
