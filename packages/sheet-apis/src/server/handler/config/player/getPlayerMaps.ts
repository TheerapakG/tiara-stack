import { Player, PartialIdPlayer, PartialNamePlayer } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Result } from "typhoon-core/schema";

const getPlayerMapsResponseSchema = Schema.Struct({
  nameToPlayer: Schema.HashMap({
    key: Schema.String,
    value: Schema.Struct({
      name: Schema.String,
      players: Schema.Array(Schema.Union(Player, PartialNamePlayer)),
    }),
  }),
  idToPlayer: Schema.HashMap({
    key: Schema.String,
    value: Schema.Array(Schema.Union(Player, PartialIdPlayer)),
  }),
});

export const getPlayerMapsHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("subscription"),
  Handler.Config.Builder.name("player.getPlayerMaps"),
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
        optimistic: getPlayerMapsResponseSchema,
        complete: getPlayerMapsResponseSchema,
      }),
      Schema.standardSchemaV1,
    ),
  }),
);
