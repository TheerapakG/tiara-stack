import { HttpApiBuilder } from "@effect/platform";
import { Effect, DateTime, pipe } from "effect";
import { Api } from "@/api";

export const HealthLive = HttpApiBuilder.group(Api, "health", (handlers) =>
  handlers
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
    ),
);
