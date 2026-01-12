import { Error, Team } from "@/server/schema";
import { pipe, Schema } from "effect";
import { DefaultTaggedClass } from "typhoon-core/schema";
import { Handler } from "typhoon-core/server";

export const botCalcHandlerData = pipe(
  Handler.Data.empty(),
  Handler.Data.Builder.type("subscription"),
  Handler.Data.Builder.name("calc.bot"),
  Handler.Data.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        config: Schema.Struct({
          healNeeded: Schema.Number,
          considerEnc: Schema.Boolean,
        }),
        players: pipe(Schema.Array(Schema.Array(DefaultTaggedClass(Team))), Schema.itemsCount(5)),
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Data.Builder.response({
    validator: pipe(
      Schema.Array(
        Schema.Struct({
          averageTalent: Schema.Number,
          averageEffectValue: Schema.Number,
          room: Schema.Array(
            Schema.Struct({
              type: Schema.String,
              team: Schema.String,
              talent: Schema.Number,
              effectValue: Schema.Number,
              tags: Schema.Array(Schema.String),
            }),
          ),
        }),
      ),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Data.Builder.responseError({
    validator: pipe(
      Schema.Union(
        Error.Core.MsgpackDecodeError,
        Error.Core.StreamExhaustedError,
        Error.Core.ValidationError,
      ),
      Schema.standardSchemaV1,
    ),
  }),
);
