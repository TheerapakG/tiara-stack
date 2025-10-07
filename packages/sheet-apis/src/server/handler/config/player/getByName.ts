import { Player, PartialNamePlayer } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";

const responseSchema = Schema.Array(Schema.Union(Player, PartialNamePlayer));

export const getByNameHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("subscription"),
  Handler.Config.Builder.name("player.getByName"),
  Handler.Config.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        guildId: Schema.String,
        names: Schema.Array(Schema.String),
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Config.Builder.response({
    validator: pipe(Schema.Array(responseSchema), Schema.standardSchemaV1),
  }),
);
