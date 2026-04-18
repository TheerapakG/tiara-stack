import { HttpApiBuilder } from "effect/unstable/httpapi";
import { DateTime, Effect } from "effect";
import { Api } from "@/api";

export const healthLayer = HttpApiBuilder.group(Api, "health", (handlers) => {
  return handlers
    .handle(
      "live",
      Effect.fnUntraced(function* () {
        const timestamp = yield* DateTime.now;
        return { status: "ok" as const, timestamp };
      }),
    )
    .handle(
      "ready",
      Effect.fnUntraced(function* () {
        const timestamp = yield* DateTime.now;
        return { status: "ok" as const, timestamp };
      }),
    );
});
