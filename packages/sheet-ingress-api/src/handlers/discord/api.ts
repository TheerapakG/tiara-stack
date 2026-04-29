import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";
import { Schema } from "effect";
import { SchemaError, ArgumentError } from "typhoon-core/error";
import { QueryResultError } from "typhoon-zero/error";
import { SheetAuthTokenAuthorization } from "../../middlewares/sheetAuthTokenAuthorization/tag";
import { DiscordUser, DiscordGuild } from "../../schemas/discord";

export class DiscordApi extends HttpApiGroup.make("discord")
  .add(
    HttpApiEndpoint.get("getCurrentUser", "/discord/user", {
      success: DiscordUser,
      error: [SchemaError, QueryResultError, ArgumentError],
    }),
  )
  .add(
    HttpApiEndpoint.get("getCurrentUserGuilds", "/discord/guilds", {
      success: Schema.Array(DiscordGuild),
      error: [SchemaError, QueryResultError, ArgumentError],
    }),
  )
  .middleware(SheetAuthTokenAuthorization)
  .annotate(OpenApi.Title, "Discord")
  .annotate(OpenApi.Description, "Discord API endpoints") {}
