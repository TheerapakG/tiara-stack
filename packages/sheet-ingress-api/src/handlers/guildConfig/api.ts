import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";
import { Schema, SchemaGetter } from "effect";
import {
  SchemaError,
  QueryResultError,
  ArgumentError,
  MutatorResultError,
} from "typhoon-core/error";
import { GuildChannelConfig, GuildConfig, GuildConfigMonitorRole } from "../../schemas/guildConfig";
import { SheetAuthTokenAuthorization } from "../../middlewares/sheetAuthTokenAuthorization/tag";

const BooleanFromString = Schema.Literals(["true", "false"]).pipe(
  Schema.decodeTo(Schema.Boolean, {
    decode: SchemaGetter.transform((value) => value === "true"),
    encode: SchemaGetter.transform((value) => (value ? "true" : "false")),
  }),
);

export class GuildConfigApi extends HttpApiGroup.make("guildConfig")
  .add(
    HttpApiEndpoint.get("getAutoCheckinGuilds", "/guildConfig/getAutoCheckinGuilds", {
      success: Schema.Array(GuildConfig),
      error: [SchemaError, QueryResultError],
    }),
  )
  .add(
    HttpApiEndpoint.get("getGuildConfig", "/guildConfig/getGuildConfig", {
      query: Schema.Struct({
        guildId: Schema.String,
      }),
      success: GuildConfig,
      error: [SchemaError, QueryResultError, ArgumentError],
    }),
  )
  .add(
    HttpApiEndpoint.post("upsertGuildConfig", "/guildConfig/upsertGuildConfig", {
      payload: Schema.Struct({
        guildId: Schema.String,
        config: Schema.Struct({
          sheetId: Schema.optional(Schema.NullOr(Schema.String)),
          autoCheckin: Schema.optional(Schema.NullOr(Schema.Boolean)),
        }),
      }),
      success: GuildConfig,
      error: [SchemaError, QueryResultError, MutatorResultError],
    }),
  )
  .add(
    HttpApiEndpoint.get("getGuildMonitorRoles", "/guildConfig/getGuildMonitorRoles", {
      query: Schema.Struct({
        guildId: Schema.String,
      }),
      success: Schema.Array(GuildConfigMonitorRole),
      error: [SchemaError, QueryResultError],
    }),
  )
  .add(
    HttpApiEndpoint.get("getGuildChannels", "/guildConfig/getGuildChannels", {
      query: Schema.Struct({
        guildId: Schema.String,
        running: Schema.optional(BooleanFromString),
      }),
      success: Schema.Array(GuildChannelConfig),
      error: [SchemaError, QueryResultError],
    }),
  )
  .add(
    HttpApiEndpoint.post("addGuildMonitorRole", "/guildConfig/addGuildMonitorRole", {
      payload: Schema.Struct({
        guildId: Schema.String,
        roleId: Schema.String,
      }),
      success: GuildConfigMonitorRole,
      error: [SchemaError, QueryResultError, MutatorResultError],
    }),
  )
  .add(
    HttpApiEndpoint.post("removeGuildMonitorRole", "/guildConfig/removeGuildMonitorRole", {
      payload: Schema.Struct({
        guildId: Schema.String,
        roleId: Schema.String,
      }),
      success: GuildConfigMonitorRole,
      error: [SchemaError, QueryResultError, MutatorResultError],
    }),
  )
  .add(
    HttpApiEndpoint.post("upsertGuildChannelConfig", "/guildConfig/upsertGuildChannelConfig", {
      payload: Schema.Struct({
        guildId: Schema.String,
        channelId: Schema.String,
        config: Schema.Struct({
          name: Schema.optional(Schema.NullOr(Schema.String)),
          running: Schema.optional(Schema.NullOr(Schema.Boolean)),
          roleId: Schema.optional(Schema.NullOr(Schema.String)),
          checkinChannelId: Schema.optional(Schema.NullOr(Schema.String)),
        }),
      }),
      success: GuildChannelConfig,
      error: [SchemaError, QueryResultError, MutatorResultError],
    }),
  )
  .add(
    HttpApiEndpoint.get("getGuildChannelById", "/guildConfig/getGuildChannelById", {
      query: Schema.Struct({
        guildId: Schema.String,
        channelId: Schema.String,
        running: Schema.optional(BooleanFromString),
      }),
      success: GuildChannelConfig,
      error: [SchemaError, QueryResultError, ArgumentError],
    }),
  )
  .add(
    HttpApiEndpoint.get("getGuildChannelByName", "/guildConfig/getGuildChannelByName", {
      query: Schema.Struct({
        guildId: Schema.String,
        channelName: Schema.String,
        running: Schema.optional(BooleanFromString),
      }),
      success: GuildChannelConfig,
      error: [SchemaError, QueryResultError, ArgumentError],
    }),
  )
  .middleware(SheetAuthTokenAuthorization)
  .annotate(OpenApi.Title, "Guild Config")
  .annotate(OpenApi.Description, "Guild config endpoints") {}
