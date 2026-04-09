import { HttpApiBuilder } from "effect/unstable/httpapi";
import { DateTime, Effect, Scope } from "effect";
import { Api } from "@/api";

let requestCounter = 0;

export const healthLayer = HttpApiBuilder.group(Api, "health", (handlers) => {
  return handlers
    .handle("live", () =>
      Effect.gen(function* () {
        const timestamp = yield* DateTime.now;
        return { status: "ok" as const, timestamp };
      }),
    )
    .handle("ready", () =>
      Effect.gen(function* () {
        const timestamp = yield* DateTime.now;
        return { status: "ok" as const, timestamp };
      }),
    )
    .handle("scopeDebug", () =>
      Effect.gen(function* () {
        const reqId = ++requestCounter;
        const scope = yield* Effect.scope;
        const scopeId = (scope as any).__debugId || "no-id";
        console.log(`[Health Scope Debug #${reqId}] Scope ID: ${scopeId}`);
        return { status: "ok", reqId, scopeId };
      }),
    )
    .handle("finalizerTest", () =>
      Effect.gen(function* () {
        const reqId = ++requestCounter;
        console.log(`[Finalizer Test #${reqId}] Handler starting`);

        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            console.log(`[Finalizer Test #${reqId}] FINALIZER RUNNING!`);
          }),
        );

        console.log(`[Finalizer Test #${reqId}] Handler completing`);
        return { status: "ok", reqId };
      }),
    );
});
