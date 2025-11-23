import { Team } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Result } from "typhoon-core/schema";

export const getTeamsHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("subscription"),
  Handler.Config.Builder.name("sheet.getTeams"),
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
        optimistic: Schema.Array(Team),
        complete: Schema.Array(Team),
      }),
      Schema.standardSchemaV1,
    ),
  }),
);
