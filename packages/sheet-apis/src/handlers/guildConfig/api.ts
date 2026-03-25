import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import { ValidationError, QueryResultError, ArgumentError } from "typhoon-core/error";
import { GuildChannelConfig, GuildConfig, GuildConfigMonitorRole } from "@/schemas/guildConfig";
import { SheetAuthTokenAuthorization } from "@/middlewares/sheetAuthTokenAuthorization/tag";

export class GuildConfigApi extends HttpApiGroup.make("guildConfig")
  .add(
    HttpApiEndpoint.get("getAutoCheckinGuilds", "/guildConfig/getAutoCheckinGuilds")
      .addSuccess(Schema.Array(GuildConfig))
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .add(
    HttpApiEndpoint.get("getGuildConfig", "/guildConfig/getGuildConfig")
      .setUrlParams(
        Schema.Struct({
          guildId: Schema.String,
        }),
      )
      .addSuccess(GuildConfig)
      .addError(Schema.Union(ValidationError, QueryResultError, ArgumentError)),
  )
  .add(
    HttpApiEndpoint.post("upsertGuildConfig", "/guildConfig/upsertGuildConfig")
      .setPayload(
        Schema.Struct({
          guildId: Schema.String,
          config: Schema.Struct({
            sheetId: Schema.optional(Schema.NullOr(Schema.String)),
            autoCheckin: Schema.optional(Schema.NullOr(Schema.Boolean)),
          }),
        }),
      )
      .addSuccess(GuildConfig)
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .add(
    HttpApiEndpoint.get("getGuildMonitorRoles", "/guildConfig/getGuildMonitorRoles")
      .setUrlParams(
        Schema.Struct({
          guildId: Schema.String,
        }),
      )
      .addSuccess(Schema.Array(GuildConfigMonitorRole))
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .add(
    HttpApiEndpoint.get("getGuildChannels", "/guildConfig/getGuildChannels")
      .setUrlParams(
        Schema.Struct({
          guildId: Schema.String,
          running: Schema.optional(Schema.BooleanFromString),
        }),
      )
      .addSuccess(Schema.Array(GuildChannelConfig))
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .add(
    HttpApiEndpoint.post("addGuildMonitorRole", "/guildConfig/addGuildMonitorRole")
      .setPayload(
        Schema.Struct({
          guildId: Schema.String,
          roleId: Schema.String,
        }),
      )
      .addSuccess(GuildConfigMonitorRole)
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .add(
    HttpApiEndpoint.post("removeGuildMonitorRole", "/guildConfig/removeGuildMonitorRole")
      .setPayload(
        Schema.Struct({
          guildId: Schema.String,
          roleId: Schema.String,
        }),
      )
      .addSuccess(GuildConfigMonitorRole)
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .add(
    HttpApiEndpoint.post("upsertGuildChannelConfig", "/guildConfig/upsertGuildChannelConfig")
      .setPayload(
        Schema.Struct({
          guildId: Schema.String,
          channelId: Schema.String,
          config: Schema.Struct({
            name: Schema.optional(Schema.NullOr(Schema.String)),
            running: Schema.optional(Schema.NullOr(Schema.Boolean)),
            roleId: Schema.optional(Schema.NullOr(Schema.String)),
            checkinChannelId: Schema.optional(Schema.NullOr(Schema.String)),
          }),
        }),
      )
      .addSuccess(GuildChannelConfig)
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .add(
    HttpApiEndpoint.get("getGuildChannelById", "/guildConfig/getGuildChannelById")
      .setUrlParams(
        Schema.Struct({
          guildId: Schema.String,
          channelId: Schema.String,
          running: Schema.optional(Schema.BooleanFromString),
        }),
      )
      .addSuccess(GuildChannelConfig)
      .addError(Schema.Union(ValidationError, QueryResultError, ArgumentError)),
  )
  .add(
    HttpApiEndpoint.get("getGuildChannelByName", "/guildConfig/getGuildChannelByName")
      .setUrlParams(
        Schema.Struct({
          guildId: Schema.String,
          channelName: Schema.String,
          running: Schema.optional(Schema.BooleanFromString),
        }),
      )
      .addSuccess(GuildChannelConfig)
      .addError(Schema.Union(ValidationError, QueryResultError, ArgumentError)),
  )
  .middleware(SheetAuthTokenAuthorization)
  .annotate(OpenApi.Title, "Guild Config")
  .annotate(OpenApi.Description, "Guild config endpoints") {}
