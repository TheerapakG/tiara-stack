import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { pipe, Schema } from "effect";
import { ValidationError, QueryResultError } from "typhoon-core/error";
import { GoogleSheetsError } from "@/schemas/google";
import { ParserFieldError } from "@/schemas/sheet/error";
import { SheetConfigError } from "@/schemas/sheetConfig";
import { Room } from "@/schemas/sheet/room";
import { Team } from "@/schemas/sheet";
import { KubernetesTokenAuthorization } from "@/middlewares/kubernetesTokenAuthorization/tag";

const CalcError = Schema.Union(
  GoogleSheetsError,
  ParserFieldError,
  SheetConfigError,
  ValidationError,
  QueryResultError,
);

export class CalcApi extends HttpApiGroup.make("calc")
  .add(
    HttpApiEndpoint.post("calcBot", "/calc/bot")
      .setPayload(
        Schema.Struct({
          config: Schema.Struct({
            healNeeded: Schema.Number,
            considerEnc: Schema.Boolean,
          }),
          players: pipe(Schema.Array(Schema.Array(Team)), Schema.itemsCount(5)),
        }),
      )
      .addSuccess(
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
      )
      .addError(ValidationError)
      .middleware(KubernetesTokenAuthorization),
  )
  .add(
    HttpApiEndpoint.post("calcSheet", "/calc/sheet")
      .setPayload(
        Schema.Struct({
          sheetId: Schema.String,
          config: Schema.Struct({
            cc: Schema.Boolean,
            considerEnc: Schema.Boolean,
            healNeeded: Schema.Number,
          }),
          players: pipe(
            Schema.Array(Schema.Struct({ name: Schema.String, encable: Schema.Boolean })),
            Schema.itemsCount(5),
          ),
          fixedTeams: Schema.Array(
            Schema.Struct({
              name: Schema.String,
              heal: Schema.Boolean,
            }),
          ),
        }),
      )
      .addSuccess(Schema.Array(Room))
      .addError(CalcError),
    // This endpoint needs to be callable from outside the cluster from the Google Sheets,
    // and it does not expose further information than what is derived from the Google Sheet with specified id,
    // so we are not adding security middleware here for now
  )
  .annotate(OpenApi.Title, "Calc")
  .annotate(OpenApi.Description, "Calculation endpoints") {}
