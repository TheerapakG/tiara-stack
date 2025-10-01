import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";

export const botCalcHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("subscription"),
  Handler.Config.Builder.name("botCalc"),
  Handler.Config.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        config: Schema.Struct({
          healNeeded: Schema.Number,
          considerEnc: Schema.Boolean,
        }),
        players: pipe(
          Schema.Array(
            Schema.Array(
              Schema.Struct({
                type: Schema.String,
                tagStr: Schema.String,
                player: Schema.String,
                team: Schema.String,
                lead: Schema.Number,
                backline: Schema.Number,
                bp: Schema.Union(Schema.Number, Schema.Literal("")),
                percent: Schema.Number,
              }),
            ),
          ),
          Schema.itemsCount(5),
        ),
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Config.Builder.response({
    validator: pipe(
      Schema.Array(
        Schema.Struct({
          averageBp: Schema.Number,
          averagePercent: Schema.Number,
          room: Schema.Array(
            Schema.Struct({
              type: Schema.String,
              team: Schema.String,
              bp: Schema.Number,
              percent: Schema.Number,
              tags: Schema.Array(Schema.String),
            }),
          ),
        }),
      ),
      Schema.standardSchemaV1,
    ),
  }),
);
