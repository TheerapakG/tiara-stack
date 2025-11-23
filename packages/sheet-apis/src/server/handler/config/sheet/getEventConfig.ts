import { EventConfig } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Result } from "typhoon-core/schema";

export const getEventConfigHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("subscription"),
  Handler.Config.Builder.name("sheetConfig.getEventConfig"),
  Handler.Config.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        guildId: Schema.String,
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Config.Builder.response({
    validator: pipe(
      Result.ResultSchema({
        optimistic: EventConfig,
        complete: EventConfig,
      }),
      Schema.standardSchemaV1,
    ),
  }),
);
