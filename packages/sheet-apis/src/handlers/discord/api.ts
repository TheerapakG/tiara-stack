import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";
import { Schema } from "effect";
import { ValidationError, QueryResultError, ArgumentError } from "typhoon-core/error";
import { SheetAuthTokenAuthorization } from "@/middlewares/sheetAuthTokenAuthorization/tag";
import { DiscordUser, DiscordGuild } from "@/schemas/discord";

export class DiscordApi extends HttpApiGroup.make("discord")
  .add(
    HttpApiEndpoint.get("getCurrentUser", "/discord/user", {
      success: DiscordUser,
      error: [ValidationError, QueryResultError, ArgumentError],
    }),
  )
  .add(
    HttpApiEndpoint.get("getCurrentUserGuilds", "/discord/guilds", {
      success: Schema.Array(DiscordGuild),
      error: [ValidationError, QueryResultError, ArgumentError],
    }),
  )
  .middleware(SheetAuthTokenAuthorization)
  .annotate(OpenApi.Title, "Discord")
  .annotate(OpenApi.Description, "Discord API endpoints") {}
