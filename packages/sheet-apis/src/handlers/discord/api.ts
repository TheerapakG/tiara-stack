import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import { ValidationError, QueryResultError, ArgumentError } from "typhoon-core/error";
import { SheetAuthTokenAuthorization } from "@/middlewares/sheetAuthTokenAuthorization/tag";

export const DiscordGuild = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  icon: Schema.optional(Schema.NullOr(Schema.String)),
  owner: Schema.Boolean,
  permissions: Schema.String,
  features: Schema.Array(Schema.String),
});

export class DiscordApi extends HttpApiGroup.make("discord")
  .add(
    HttpApiEndpoint.get("getCurrentUserGuilds", "/discord/guilds")
      .addSuccess(Schema.Array(DiscordGuild))
      .addError(Schema.Union(ValidationError, QueryResultError, ArgumentError)),
  )
  .middleware(SheetAuthTokenAuthorization)
  .annotate(OpenApi.Title, "Discord")
  .annotate(OpenApi.Description, "Discord API endpoints") {}
