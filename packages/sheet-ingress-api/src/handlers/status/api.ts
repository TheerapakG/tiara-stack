import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";
import { UnknownError } from "typhoon-core/error";
import { SheetAuthTokenAuthorization } from "../../middlewares/sheetAuthTokenAuthorization/tag";
import { ServicesStatusResponse } from "./schema";

export class StatusApi extends HttpApiGroup.make("status")
  .add(
    HttpApiEndpoint.get("getServices", "/status/services", {
      success: ServicesStatusResponse,
      error: UnknownError,
    }),
  )
  .middleware(SheetAuthTokenAuthorization)
  .annotate(OpenApi.Title, "Status")
  .annotate(OpenApi.Description, "Service status endpoints") {}
