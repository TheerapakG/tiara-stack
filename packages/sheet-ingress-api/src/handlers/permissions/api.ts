import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";
import { Schema } from "effect";
import { SchemaError, QueryResultError, ArgumentError } from "typhoon-core/error";
import { SheetAuthTokenAuthorization } from "../../middlewares/sheetAuthTokenAuthorization/tag";
import { CurrentUserPermissions, ResolvedUserPermissions } from "../../schemas/permissions";

export class PermissionsApi extends HttpApiGroup.make("permissions")
  .add(
    HttpApiEndpoint.get("getCurrentUserPermissions", "/permissions", {
      query: Schema.Struct({
        guildId: Schema.optional(Schema.String),
      }),
      success: CurrentUserPermissions,
      error: [SchemaError, QueryResultError, ArgumentError],
    }),
  )
  .add(
    HttpApiEndpoint.post("resolveTokenPermissions", "/permissions/resolveTokenPermissions", {
      payload: Schema.Struct({
        token: Schema.Redacted(Schema.String),
        guildId: Schema.optional(Schema.String),
      }),
      success: ResolvedUserPermissions,
      error: [SchemaError, QueryResultError, ArgumentError],
    }).annotate(OpenApi.Exclude, true),
  )
  .middleware(SheetAuthTokenAuthorization)
  .annotate(OpenApi.Title, "Permissions")
  .annotate(OpenApi.Description, "Permission endpoints") {}
