import { pipe, Schema } from "effect";
import { Msgpack, Stream, Validation } from "typhoon-core/error";
import { Handler } from "typhoon-core/server";

export const botCalcHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("subscription"),
  Handler.Config.Builder.name("calc.bot"),
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
                talent: Schema.Union(Schema.Number, Schema.Literal("")),
                effectValue: Schema.Number,
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
  Handler.Config.Builder.responseError({
    validator: pipe(
      Schema.Union(
        Msgpack.MsgpackDecodeError,
        Stream.StreamExhaustedError,
        Validation.ValidationError,
      ),
      Schema.standardSchemaV1,
    ),
  }),
);
