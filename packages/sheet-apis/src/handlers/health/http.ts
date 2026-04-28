import { DateTime, Effect } from "effect";
import { HealthRpcs } from "sheet-ingress-api/sheet-apis-rpc";

export const healthLayer = HealthRpcs.toLayer({
  "health.live": Effect.fnUntraced(function* () {
    const timestamp = yield* DateTime.now;
    return { status: "ok" as const, timestamp };
  }),
  "health.ready": Effect.fnUntraced(function* () {
    const timestamp = yield* DateTime.now;
    return { status: "ok" as const, timestamp };
  }),
});
