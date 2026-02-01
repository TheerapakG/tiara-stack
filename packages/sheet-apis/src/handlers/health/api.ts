import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { HealthResponseSchema } from "./schema";

export class HealthApi extends HttpApiGroup.make("health")
  .add(HttpApiEndpoint.get("live", "/live").addSuccess(HealthResponseSchema))
  .add(HttpApiEndpoint.get("ready", "/ready").addSuccess(HealthResponseSchema))
  // This endpoint needs to be callable by the Kubernetes health check,
  // and it does not expose any sensitive information,
  // so we are not adding security middleware here.
  .annotate(OpenApi.Title, "Health")
  .annotate(OpenApi.Description, "Health check endpoints") {}
