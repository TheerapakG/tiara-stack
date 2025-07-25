import { StandardSchemaV1 } from "@standard-schema/spec";
import { Chunk, Data, Effect, pipe } from "effect";
import { RequestParamsConfig } from "typhoon-core/config";
import {
  HeaderEncoderDecoder,
  MsgpackEncoderDecoder,
} from "typhoon-core/protocol";
import { validate } from "typhoon-core/schema";
import {
  MutationHandlerContext,
  Server,
  ServerMutationHandlers,
  ServerSubscriptionHandlers,
  SubscriptionHandlerContext,
} from "typhoon-core/server";
import * as v from "valibot";

export class HandlerError extends Data.TaggedError("HandlerError")<{
  error: unknown;
}> {}

export class AppsScriptClient<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  SubscriptionHandlers extends Record<
    string,
    SubscriptionHandlerContext
  > = Record<string, SubscriptionHandlerContext>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  MutationHandlers extends Record<string, MutationHandlerContext> = Record<
    string,
    MutationHandlerContext
  >,
> {
  constructor(private readonly url: string) {}

  static create<
    S extends Server<
      Record<string, SubscriptionHandlerContext>,
      Record<string, MutationHandlerContext>
    >,
  >(
    url: string,
  ): Effect.Effect<
    AppsScriptClient<ServerSubscriptionHandlers<S>, ServerMutationHandlers<S>>,
    never,
    never
  > {
    return pipe(
      Effect.Do,
      Effect.map(
        () =>
          new AppsScriptClient<
            ServerSubscriptionHandlers<S>,
            ServerMutationHandlers<S>
          >(url),
      ),
      Effect.withSpan("AppsScriptClient.create"),
    );
  }

  static once<
    ServerSubscriptionHandlers extends Record<
      string,
      SubscriptionHandlerContext
    >,
    Handler extends keyof ServerSubscriptionHandlers & string,
  >(
    client: AppsScriptClient<
      ServerSubscriptionHandlers,
      Record<string, MutationHandlerContext>
    >,
    handler: Handler,
    // TODO: make this conditionally optional
    data?: ServerSubscriptionHandlers[Handler]["config"]["requestParams"] extends RequestParamsConfig
      ? StandardSchemaV1.InferInput<
          ServerSubscriptionHandlers[Handler]["config"]["requestParams"]["validator"]
        >
      : never,
  ) {
    return pipe(
      Effect.Do,
      Effect.let("id", () => Utilities.getUuid() as string),
      Effect.bind("requestHeader", ({ id }) =>
        HeaderEncoderDecoder.encode({
          protocol: "typh",
          version: 1,
          id,
          action: "client:once",
          payload: {
            handler: handler,
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
          Effect.flatMap(Chunk.get(0)),
          Effect.flatMap(validate(v.array(v.tuple([v.number(), v.unknown()])))),
          Effect.flatMap(HeaderEncoderDecoder.decode),
        ),
      ),
      // TODO: check if the response is a valid header
      Effect.bind("decodedResponse", ({ pullDecodedStream }) =>
        pipe(pullDecodedStream, Effect.flatMap(Chunk.get(0))),
      ),
      Effect.flatMap(({ header, decodedResponse }) =>
        header.action === "server:update" && header.payload.success
          ? Effect.succeed(
              decodedResponse as StandardSchemaV1.InferOutput<
                ServerSubscriptionHandlers[Handler]["config"]["response"]["validator"]
              >,
            )
          : Effect.fail(new HandlerError({ error: decodedResponse })),
      ),
      Effect.scoped,
      Effect.withSpan("AppsScriptClient.once"),
    );
  }
}
