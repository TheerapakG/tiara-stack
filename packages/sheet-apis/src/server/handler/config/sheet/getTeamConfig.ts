import { TeamConfig } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Result } from "typhoon-core/schema";

export const getTeamConfigHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("subscription"),
  Handler.Config.Builder.name("sheetConfig.getTeamConfig"),
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
        optimistic: Schema.Array(TeamConfig),
        complete: Schema.Array(TeamConfig),
      }),
      Schema.standardSchemaV1,
    ),
  }),
);
