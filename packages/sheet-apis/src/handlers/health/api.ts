import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";
import { Schema } from "effect";
import { HealthResponseSchema } from "./schema";

const ScopeDebugResponseSchema = Schema.Struct({
  status: Schema.Literal("ok"),
  reqId: Schema.Number,
  scopeId: Schema.String,
});

export class HealthApi extends HttpApiGroup.make("health")
  .add(HttpApiEndpoint.get("live", "/live", { success: HealthResponseSchema }))
  .add(HttpApiEndpoint.get("ready", "/ready", { success: HealthResponseSchema }))
  .add(HttpApiEndpoint.get("scopeDebug", "/scope-debug", { success: ScopeDebugResponseSchema }))
  // This endpoint needs to be callable by the Kubernetes health check,
  // and it does not expose any sensitive information,
  // so we are not adding security middleware here.
  .annotate(OpenApi.Title, "Health")
  .annotate(OpenApi.Description, "Health check endpoints") {}
