import { encode } from "@msgpack/msgpack";
import { StandardSchemaV1 } from "@standard-schema/spec";
import { type } from "arktype";
import { Chunk, Data, Effect, pipe } from "effect";
import { ofetch } from "ofetch";
import { RequestParamsConfig } from "../config";
import { blobToPullDecodedStream, HeaderEncoderDecoder } from "../protocol";
import { validate } from "../schema";
import {
  MutationHandlerContext,
  Server,
  ServerMutationHandlers,
  ServerSubscriptionHandlers,
  SubscriptionHandlerContext,
} from "../server";

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
      Effect.let("id", () => crypto.randomUUID() as string),
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
      Effect.let("requestHeaderEncoded", ({ requestHeader }) =>
        encode(requestHeader),
      ),
      Effect.let("dataEncoded", () => encode(data)),
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
        blobToPullDecodedStream(blob),
      ),
      Effect.bind("header", ({ pullDecodedStream }) =>
        pipe(
          pullDecodedStream,
          Effect.flatMap(Chunk.get(0)),
          Effect.flatMap(validate(type([["number", "unknown"], "[]"]))),
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
