import { GuildChannelConfig } from "@/server/schema";
import { pipe, Schema } from "effect";
import { HandlerConfig } from "typhoon-core/config";

const responseSchema = Schema.OptionFromNullishOr(
  GuildChannelConfig,
  undefined,
);
export const upsertGuildChannelConfigHandlerConfig = pipe(
  HandlerConfig.empty,
  HandlerConfig.Builder.name("guildConfig.upsertGuildChannelConfig"),
  HandlerConfig.Builder.type("mutation"),
  HandlerConfig.Builder.requestParams({
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
  HandlerConfig.Builder.response({
    validator: pipe(responseSchema, Schema.standardSchemaV1),
  }),
);
