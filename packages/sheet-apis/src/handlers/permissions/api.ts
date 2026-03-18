import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import { ValidationError, QueryResultError, ArgumentError } from "typhoon-core/error";
import { SheetAuthTokenAuthorization } from "@/middlewares/sheetAuthTokenAuthorization/tag";
import { CurrentUserPermissions } from "@/schemas/permissions";

export class PermissionsApi extends HttpApiGroup.make("permissions")
  .add(
    HttpApiEndpoint.get("getCurrentUserPermissions", "/permissions")
      .setUrlParams(
        Schema.Struct({
          guildId: Schema.optional(Schema.String),
        }),
      )
      .addSuccess(CurrentUserPermissions)
      .addError(Schema.Union(ValidationError, QueryResultError, ArgumentError)),
  )
  .middleware(SheetAuthTokenAuthorization)
  .annotate(OpenApi.Title, "Permissions")
  .annotate(OpenApi.Description, "Permission endpoints") {}
