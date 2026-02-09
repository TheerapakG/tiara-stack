import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import { ValidationError, QueryResultError, ArgumentError } from "typhoon-core/error";
import { GuildChannelConfig, GuildConfig, GuildConfigManagerRole } from "@/schemas/guildConfig";
import { KubernetesTokenAuthorization } from "@/middlewares/kubernetesTokenAuthorization/tag";

export class GuildConfigApi extends HttpApiGroup.make("guildConfig")
  .add(
    HttpApiEndpoint.get("getAutoCheckinGuilds", "/guildConfig/getAutoCheckinGuilds")
      .addSuccess(Schema.Array(GuildConfig))
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .add(
    HttpApiEndpoint.get("getGuildConfigByGuildId", "/guildConfig/getGuildConfigByGuildId")
      .setUrlParams(
        Schema.Struct({
          guildId: Schema.String,
        }),
      )
      .addSuccess(GuildConfig)
      .addError(Schema.Union(ValidationError, QueryResultError, ArgumentError)),
  )
  .add(
    HttpApiEndpoint.get("getGuildConfigByScriptId", "/guildConfig/getGuildConfigByScriptId")
      .setUrlParams(
        Schema.Struct({
          scriptId: Schema.String,
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
            scriptId: Schema.optional(Schema.NullOr(Schema.String)),
            sheetId: Schema.optional(Schema.NullOr(Schema.String)),
            autoCheckin: Schema.optional(Schema.NullOr(Schema.Boolean)),
          }),
        }),
      )
      .addSuccess(GuildConfig)
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .add(
    HttpApiEndpoint.get("getGuildManagerRoles", "/guildConfig/getGuildManagerRoles")
      .setUrlParams(
        Schema.Struct({
          guildId: Schema.String,
        }),
      )
      .addSuccess(Schema.Array(GuildConfigManagerRole))
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .add(
    HttpApiEndpoint.post("addGuildManagerRole", "/guildConfig/addGuildManagerRole")
      .setPayload(
        Schema.Struct({
          guildId: Schema.String,
          roleId: Schema.String,
        }),
      )
      .addSuccess(GuildConfigManagerRole)
      .addError(Schema.Union(ValidationError, QueryResultError)),
  )
  .add(
    HttpApiEndpoint.post("removeGuildManagerRole", "/guildConfig/removeGuildManagerRole")
      .setPayload(
        Schema.Struct({
          guildId: Schema.String,
          roleId: Schema.String,
        }),
      )
      .addSuccess(GuildConfigManagerRole)
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
    HttpApiEndpoint.get("getGuildRunningChannelById", "/guildConfig/getGuildRunningChannelById")
      .setUrlParams(
        Schema.Struct({
          guildId: Schema.String,
          channelId: Schema.String,
        }),
      )
      .addSuccess(GuildChannelConfig)
      .addError(Schema.Union(ValidationError, QueryResultError, ArgumentError)),
  )
  .add(
    HttpApiEndpoint.get("getGuildRunningChannelByName", "/guildConfig/getGuildRunningChannelByName")
      .setUrlParams(
        Schema.Struct({
          guildId: Schema.String,
          channelName: Schema.String,
        }),
      )
      .addSuccess(GuildChannelConfig)
      .addError(Schema.Union(ValidationError, QueryResultError, ArgumentError)),
  )
  .middleware(KubernetesTokenAuthorization)
  .annotate(OpenApi.Title, "Guild Config")
  .annotate(OpenApi.Description, "Guild config endpoints") {}
