import { GuildConfig } from "@/server/schema";
import { pipe, Schema } from "effect";
import { HandlerConfig } from "typhoon-core/config";

const responseSchema = Schema.OptionFromNullishOr(GuildConfig, undefined);
export const upsertGuildConfigHandlerConfig = pipe(
  HandlerConfig.empty,
  HandlerConfig.Builder.name("guildConfig.upsertGuildConfig"),
  HandlerConfig.Builder.type("mutation"),
  HandlerConfig.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        guildId: Schema.String,
        scriptId: Schema.optional(Schema.NullishOr(Schema.String)),
        sheetId: Schema.optional(Schema.NullishOr(Schema.String)),
      }),
      Schema.standardSchemaV1,
    ),
  }),
  HandlerConfig.Builder.response({
    validator: pipe(responseSchema, Schema.standardSchemaV1),
  }),
);
