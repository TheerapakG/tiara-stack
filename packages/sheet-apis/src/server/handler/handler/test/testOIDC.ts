import { testOIDCHandlerConfig } from "@/server/handler/config";
import { AuthService } from "@/server/services";
import { Effect, pipe } from "effect";
import { computed } from "typhoon-core/signal";
import { defineHandlerBuilder, Event } from "typhoon-server/server";

export const testOIDCHandler = defineHandlerBuilder()
  .config(testOIDCHandlerConfig)
  .handler(
    pipe(
      Effect.Do,
      Effect.bind("parsed", () =>
        Event.withConfig(testOIDCHandlerConfig).request.parsed(),
      ),
      Effect.flatMap(({ parsed }) =>
        pipe(
          computed(
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
  );
