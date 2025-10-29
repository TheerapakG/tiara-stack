import { Error, Room } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";

export const sheetCalcHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("subscription"),
  Handler.Config.Builder.name("calc.sheet"),
  Handler.Config.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        sheetId: Schema.String,
        config: Schema.Struct({
          cc: Schema.Boolean,
          considerEnc: Schema.Boolean,
          healNeeded: Schema.Number,
        }),
        players: pipe(
          Schema.Array(
            Schema.Struct({ name: Schema.String, encable: Schema.Boolean }),
          ),
          Schema.itemsCount(5),
        ),
        fixedTeams: Schema.Array(
          Schema.Struct({
            name: Schema.String,
            heal: Schema.Boolean,
          }),
        ),
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Config.Builder.response({
    validator: pipe(Schema.Array(Room), Schema.standardSchemaV1),
  }),
  Handler.Config.Builder.responseError({
    validator: pipe(
      Schema.Union(
        Error.Core.MsgpackDecodeError,
        Error.Core.StreamExhaustedError,
        Error.Core.ValidationError,
        Error.GoogleSheetsError,
        Error.ParserFieldError,
        Error.SheetConfigError,
      ),
      Schema.standardSchemaV1,
    ),
  }),
);
