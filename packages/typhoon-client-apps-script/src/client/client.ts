import { StandardSchemaV1 } from "@standard-schema/spec";
import { Data, Effect, HashMap, Option, pipe, SynchronizedRef } from "effect";
import {
  HandlerConfigGroup,
  MutationHandlerConfig,
  RequestParamsConfig,
  SubscriptionHandlerConfig,
} from "typhoon-core/config";
import {
  HeaderEncoderDecoder,
  MsgpackEncoderDecoder,
} from "typhoon-core/protocol";
import { validate } from "typhoon-core/schema";
import * as v from "valibot";

export class HandlerError extends Data.TaggedError("HandlerError") {}

export class AppsScriptClient<
  SubscriptionHandlerConfigs extends Record<
    string,
    SubscriptionHandlerConfig
  > = Record<string, SubscriptionHandlerConfig>,
  MutationHandlerConfigs extends Record<string, MutationHandlerConfig> = Record<
    string,
    MutationHandlerConfig
  >,
> {
  constructor(
    private readonly url: string,
    private readonly configGroup: HandlerConfigGroup<
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
      SubscriptionHandlerConfig
    >,
    MutationHandlerConfigs extends Record<string, MutationHandlerConfig>,
  >(
    configGroup: HandlerConfigGroup<
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
          >(url, configGroup, token),
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
        Record<string, SubscriptionHandlerConfig>,
        Record<string, MutationHandlerConfig>
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
      SubscriptionHandlerConfig
    >,
    Handler extends keyof SubscriptionHandlerConfigs & string,
  >(
    client: AppsScriptClient<
      SubscriptionHandlerConfigs,
      Record<string, MutationHandlerConfig>
    >,
    handler: Handler,
    // TODO: make this conditionally optional
    data?: SubscriptionHandlerConfigs[Handler]["requestParams"] extends RequestParamsConfig
      ? StandardSchemaV1.InferInput<
          SubscriptionHandlerConfigs[Handler]["requestParams"]["validator"]
        >
      : never,
  ) {
    return pipe(
      Effect.Do,
      Effect.let("id", () => Utilities.getUuid() as string),
      Effect.bind("token", () => client.token),
      Effect.bind("requestHeader", ({ id, token }) =>
        HeaderEncoderDecoder.encode({
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
        MsgpackEncoderDecoder.encode(requestHeader),
      ),
      Effect.bind("dataEncoded", () => MsgpackEncoderDecoder.encode(data)),
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
      Effect.bind("pullDecodedStream", ({ bytes }) =>
        MsgpackEncoderDecoder.bytesToPullDecodedStream(bytes),
      ),
      Effect.bind("header", ({ pullDecodedStream }) =>
        pipe(
          pullDecodedStream,
          Effect.flatMap(validate(v.array(v.tuple([v.number(), v.unknown()])))),
          Effect.flatMap(HeaderEncoderDecoder.decode),
        ),
      ),
      // TODO: check if the response is a valid header
      Effect.bind(
        "decodedResponse",
        ({ pullDecodedStream }) => pullDecodedStream,
      ),
      Effect.bind("config", () =>
        HashMap.get(client.configGroup.subscriptionHandlerMap, handler),
      ),
      Effect.flatMap(({ header, decodedResponse, config }) =>
        header.action === "server:update" && header.payload.success
          ? pipe(
              decodedResponse,
              validate(
                config.response
                  .validator as SubscriptionHandlerConfigs[Handler]["response"]["validator"],
              ),
              Effect.catchAll((error) =>
                Effect.fail(
                  new HandlerError({ cause: error } as unknown as void),
                ),
              ),
            )
          : Effect.fail(new HandlerError(decodedResponse as void)),
      ),
      Effect.scoped,
      Effect.withSpan("AppsScriptClient.once"),
    );
  }
}
