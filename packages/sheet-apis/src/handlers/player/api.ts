import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import { ValidationError, QueryResultError } from "typhoon-core/error";
import { GoogleSheetsError } from "@/schemas/google";
import { ParserFieldError } from "@/schemas/sheet/error";
import { SheetConfigError } from "@/schemas/sheetConfig";
import { Player, PartialIdPlayer, PartialNamePlayer, Team } from "@/schemas/sheet";
import { KubernetesTokenAuthorization } from "@/middlewares/kubernetesTokenAuthorization/tag";

const PlayerError = Schema.Union(
  GoogleSheetsError,
  ParserFieldError,
  SheetConfigError,
  ValidationError,
  QueryResultError,
);

export class PlayerApi extends HttpApiGroup.make("player")
  .add(
    HttpApiEndpoint.get("getPlayerMaps", "/player/getPlayerMaps")
      .setUrlParams(Schema.Struct({ guildId: Schema.String }))
      .addSuccess(
        Schema.Struct({
          nameToPlayer: Schema.Array(
            Schema.Struct({
              key: Schema.String,
              value: Schema.Struct({
                name: Schema.String,
                players: Schema.Array(Player),
              }),
            }),
          ),
          idToPlayer: Schema.Array(
            Schema.Struct({
              key: Schema.String,
              value: Schema.Array(Player),
            }),
          ),
        }),
      )
      .addError(PlayerError),
  )
  .add(
    HttpApiEndpoint.get("getByIds", "/player/getByIds")
      .setUrlParams(Schema.Struct({ guildId: Schema.String, ids: Schema.Array(Schema.String) }))
      .addSuccess(Schema.Array(Schema.Array(Schema.Union(Player, PartialIdPlayer))))
      .addError(PlayerError),
  )
  .add(
    HttpApiEndpoint.get("getByNames", "/player/getByNames")
      .setUrlParams(Schema.Struct({ guildId: Schema.String, names: Schema.Array(Schema.String) }))
      .addSuccess(Schema.Array(Schema.Array(Schema.Union(Player, PartialNamePlayer))))
      .addError(PlayerError),
  )
  .add(
    HttpApiEndpoint.get("getTeamsByIds", "/player/getTeamsByIds")
      .setUrlParams(Schema.Struct({ guildId: Schema.String, ids: Schema.Array(Schema.String) }))
      .addSuccess(Schema.Array(Schema.Array(Team)))
      .addError(PlayerError),
  )
  .add(
    HttpApiEndpoint.get("getTeamsByNames", "/player/getTeamsByNames")
      .setUrlParams(Schema.Struct({ guildId: Schema.String, names: Schema.Array(Schema.String) }))
      .addSuccess(Schema.Array(Schema.Array(Team)))
      .addError(PlayerError),
  )
  .middleware(KubernetesTokenAuthorization)
  .annotate(OpenApi.Title, "Player")
  .annotate(OpenApi.Description, "Player data endpoints") {}
