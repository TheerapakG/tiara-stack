import { testOIDCHandlerConfig } from "@/server/handler/config";
import { AuthService } from "@/server/services";
import { Effect, pipe } from "effect";
import { HandlerContextConfig } from "typhoon-core/config";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/server";

export const testOIDCHandler = pipe(
  HandlerContextConfig.empty,
  HandlerContextConfig.Builder.config(testOIDCHandlerConfig),
  HandlerContextConfig.Builder.handler(
    pipe(
      Effect.Do,
      Effect.bind("parsed", () => Event.request.parsed(testOIDCHandlerConfig)),
      Effect.flatMap(({ parsed }) =>
        pipe(
          Computed.make(
            pipe(
              Effect.Do,
              Effect.bind("parsed", () => parsed),
              Effect.let("token", ({ parsed }) => parsed.token),
              Effect.bind("result", ({ token }) => AuthService.verify(token)),
              Effect.map(({ result }) => ({
                payload: result.payload,
              })),
            ),
          ),
        ),
      ),
      Effect.withSpan("testOIDCHandler", { captureStackTrace: true }),
    ),
  ),
);
