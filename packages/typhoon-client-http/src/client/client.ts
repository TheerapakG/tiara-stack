import { StandardSchemaV1 } from "@standard-schema/spec";
import { Data, Effect, HashMap, Option, pipe, SynchronizedRef } from "effect";
import { ofetch } from "ofetch";
import { HandlerConfig } from "typhoon-core/config";
import {
  HeaderEncoderDecoder,
  MsgpackEncoderDecoder,
} from "typhoon-core/protocol";
import { validate } from "typhoon-core/validator";
import * as v from "valibot";

export class HandlerError extends Data.TaggedError("HandlerError") {}

export class HttpClient<
  SubscriptionHandlerConfigs extends Record<
    string,
    HandlerConfig.SubscriptionHandlerConfig
  > = Record<string, HandlerConfig.SubscriptionHandlerConfig>,
  MutationHandlerConfigs extends Record<
    string,
    HandlerConfig.MutationHandlerConfig
  > = Record<string, HandlerConfig.MutationHandlerConfig>,
> {
  constructor(
    private readonly url: string,
    private readonly configGroup: HandlerConfig.Group.HandlerConfigGroup<
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
      HandlerConfig.SubscriptionHandlerConfig
    >,
    MutationHandlerConfigs extends Record<
      string,
      HandlerConfig.MutationHandlerConfig
    >,
  >(
    configGroup: HandlerConfig.Group.HandlerConfigGroup<
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
            configGroup,
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
        Record<string, HandlerConfig.SubscriptionHandlerConfig>,
        Record<string, HandlerConfig.MutationHandlerConfig>
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
      HandlerConfig.SubscriptionHandlerConfig
    >,
    Handler extends keyof SubscriptionHandlerConfigs & string,
  >(
    client: HttpClient<
      SubscriptionHandlerConfigs,
      Record<string, HandlerConfig.MutationHandlerConfig>
    >,
    handler: Handler,
    // TODO: make this conditionally optional
    data?: HandlerConfig.ResolvedRequestParamsValidator<
      HandlerConfig.RequestParamsOrUndefined<
        SubscriptionHandlerConfigs[Handler]
      >
    > extends infer Validator extends StandardSchemaV1
      ? StandardSchemaV1.InferInput<Validator>
      : never,
  ) {
    return pipe(
      Effect.Do,
      Effect.let("id", () => crypto.randomUUID() as string),
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
      Effect.bind("blob", ({ requestBuffer }) =>
        Effect.tryPromise(() =>
          ofetch(client.url, {
            method: "POST",
            body: requestBuffer,
            responseType: "blob",
          }),
        ),
      ),
      Effect.bind("pullDecodedStream", ({ blob }) =>
        MsgpackEncoderDecoder.blobToPullDecodedStream(blob),
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
                HandlerConfig.resolveResponseValidator(
                  HandlerConfig.response(
                    config as SubscriptionHandlerConfigs[Handler],
                  ),
                ),
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
      Effect.withSpan("HttpClient.once", {
        captureStackTrace: true,
      }),
    );
  }
}
