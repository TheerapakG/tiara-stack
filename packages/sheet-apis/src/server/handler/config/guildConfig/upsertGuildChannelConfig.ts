import { GuildChannelConfig } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";

const responseSchema = Schema.OptionFromNullishOr(
  GuildChannelConfig,
  undefined,
);
export const upsertGuildChannelConfigHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("mutation"),
  Handler.Config.Builder.name("guildConfig.upsertGuildChannelConfig"),
  Handler.Config.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        guildId: Schema.String,
        channelId: Schema.String,
        name: Schema.optional(Schema.NullishOr(Schema.String)),
        running: Schema.optional(Schema.Boolean),
        roleId: Schema.optional(Schema.NullishOr(Schema.String)),
        checkinChannelId: Schema.optional(Schema.NullishOr(Schema.String)),
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Config.Builder.response({
    validator: pipe(responseSchema, Schema.standardSchemaV1),
  }),
);
