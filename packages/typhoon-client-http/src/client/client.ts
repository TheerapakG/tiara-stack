import { encode } from "@msgpack/msgpack";
import { StandardSchemaV1 } from "@standard-schema/spec";
import { Chunk, Effect, pipe } from "effect";
import { ofetch } from "ofetch";
import { blobToPullDecodedStream, Header } from "typhoon-core/protocol";
import {
  MutationHandlerContext,
  Server,
  ServerMutationHandlers,
  ServerSubscriptionHandlers,
  SubscriptionHandlerContext,
} from "typhoon-core/server";

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
  ) {
    return pipe(
      Effect.Do,
      Effect.let("id", () => crypto.randomUUID() as string),
      Effect.bind("requestHeader", ({ id }) =>
        Header.encode({
          protocol: "typh",
          version: 1,
          id,
          action: "client:once",
          handler: handler,
        }),
      ),
      Effect.let("requestHeaderEncoded", ({ requestHeader }) =>
        encode(requestHeader),
      ),
      Effect.bind("blob", ({ requestHeaderEncoded }) =>
        Effect.tryPromise(() =>
          ofetch(client.url, {
            method: "POST",
            body: requestHeaderEncoded,
            responseType: "blob",
          }),
        ),
      ),
      Effect.bind("pullDecodedStream", ({ blob }) =>
        blobToPullDecodedStream(blob),
      ),
      Effect.tap(({ pullDecodedStream }) => pullDecodedStream),
      // TODO: check if the response is a valid header
      Effect.flatMap(
        ({ pullDecodedStream }) =>
          pipe(
            pullDecodedStream,
            Effect.flatMap(Chunk.get(0)),
          ) as Effect.Effect<
            StandardSchemaV1.InferOutput<
              ServerSubscriptionHandlers[Handler]["config"]["response"]["validator"]
            >
          >,
      ),
      Effect.withSpan("AppsScriptClient.once"),
    );
  }
}
