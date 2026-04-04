import { HttpApiBuilder } from "effect/unstable/httpapi";
import { DateTime, Effect, pipe } from "effect";
import { Api } from "@/api";

export const healthLayer = HttpApiBuilder.group(Api, "health", (handlers) => {
  return handlers
    .handle("live", () =>
      pipe(
        DateTime.now,
        Effect.map((timestamp) => ({ status: "ok" as const, timestamp })),
      ),
    )
    .handle("ready", () =>
      pipe(
        DateTime.now,
        Effect.map((timestamp) => ({ status: "ok" as const, timestamp })),
      ),
    );
});
