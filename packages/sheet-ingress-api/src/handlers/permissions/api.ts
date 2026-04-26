import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";
import { Redacted, Schema, SchemaGetter } from "effect";
import { SchemaError, QueryResultError, ArgumentError } from "typhoon-core/error";
import { SheetAuthTokenAuthorization } from "../../middlewares/sheetAuthTokenAuthorization/tag";
import { CurrentUserPermissions, ResolvedUserPermissions } from "../../schemas/permissions";

export const RedactedStringFromJsonString = Schema.String.pipe(
  Schema.decodeTo(Schema.Redacted(Schema.String), {
    decode: SchemaGetter.transform((token: string) => Redacted.make(token)),
    encode: SchemaGetter.transform((token: Redacted.Redacted<string>) => Redacted.value(token)),
  }),
);

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
        token: RedactedStringFromJsonString,
        guildId: Schema.optional(Schema.String),
      }),
      success: ResolvedUserPermissions,
      error: [SchemaError, QueryResultError, ArgumentError],
    }).annotate(OpenApi.Exclude, true),
  )
  .middleware(SheetAuthTokenAuthorization)
  .annotate(OpenApi.Title, "Permissions")
  .annotate(OpenApi.Description, "Permission endpoints") {}
