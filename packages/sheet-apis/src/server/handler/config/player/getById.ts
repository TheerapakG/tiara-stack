import { Player, PartialIdPlayer } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Result } from "typhoon-core/schema";

export const getByIdHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("subscription"),
  Handler.Config.Builder.name("player.getById"),
  Handler.Config.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        guildId: Schema.String,
        ids: Schema.Array(Schema.String),
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Config.Builder.response({
    validator: pipe(
      Result.ResultSchema({
        optimistic: Schema.Array(
          Schema.Array(Schema.Union(Player, PartialIdPlayer)),
        ),
        complete: Schema.Array(
          Schema.Array(Schema.Union(Player, PartialIdPlayer)),
        ),
      }),
      Schema.standardSchemaV1,
    ),
  }),
);
