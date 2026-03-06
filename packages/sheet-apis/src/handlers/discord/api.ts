import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import { ValidationError, QueryResultError, ArgumentError } from "typhoon-core/error";
import { SheetAuthTokenAuthorization } from "@/middlewares/sheetAuthTokenAuthorization/tag";
import { DiscordUser, DiscordGuild } from "@/schemas/discord";

export class DiscordApi extends HttpApiGroup.make("discord")
  .add(
    HttpApiEndpoint.get("getCurrentUser", "/discord/user")
      .addSuccess(DiscordUser)
      .addError(Schema.Union(ValidationError, QueryResultError, ArgumentError)),
  )
  .add(
    HttpApiEndpoint.get("getCurrentUserGuilds", "/discord/guilds")
      .addSuccess(Schema.Array(DiscordGuild))
      .addError(Schema.Union(ValidationError, QueryResultError, ArgumentError)),
  )
  .middleware(SheetAuthTokenAuthorization)
  .annotate(OpenApi.Title, "Discord")
  .annotate(OpenApi.Description, "Discord API endpoints") {}
