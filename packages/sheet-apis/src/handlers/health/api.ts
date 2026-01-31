import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { HealthResponseSchema } from "./schema";

export class HealthApi extends HttpApiGroup.make("health")
  .add(HttpApiEndpoint.get("live", "/live").addSuccess(HealthResponseSchema))
  .add(HttpApiEndpoint.get("ready", "/ready").addSuccess(HealthResponseSchema))
  .annotate(OpenApi.Title, "Health")
  .annotate(OpenApi.Description, "Health check endpoints") {}
