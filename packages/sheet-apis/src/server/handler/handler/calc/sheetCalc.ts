import { sheetCalcHandlerConfig } from "@/server/handler/config";
import { CalcConfig, CalcService, PlayerTeam, Sheet } from "@/server/services";
import { Array, Chunk, Effect, HashSet, pipe, Schema } from "effect";
import { Computed } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { Handler } from "typhoon-core/server";

const builders = Context.Subscription.Builder.builders();
export const sheetCalcHandler = pipe(
  builders.empty(),
  builders.data(sheetCalcHandlerConfig),
  builders.handler(
    pipe(
      Event.request.parsed(sheetCalcHandlerConfig),
      Computed.flatMap(({ sheetId, config, players }) =>
        pipe(
          Effect.Do,
          Effect.let("config", () => new CalcConfig(config)),
          Effect.bind("playerTeams", () =>
            Effect.forEach(players, (player) =>
              pipe(
                Sheet.PlayerService.getTeamsByName(player),
                Effect.map(Array.map(PlayerTeam.fromTeam)),
                Effect.map(Array.getSomes),
              ),
            ),
          ),
          Effect.flatMap(({ config, playerTeams }) =>
            CalcService.calc(config, playerTeams),
          ),
          Effect.map(
            Chunk.map(({ bp, percent, teams }) => ({
              averageBp: bp / 5,
              averagePercent: percent / 5,
              room: pipe(
                teams,
                Chunk.map(({ type, team, bp, percent, tags }) => ({
                  type,
                  team,
                  bp,
                  percent,
                  tags: HashSet.toValues(tags),
                })),
                Chunk.toArray,
              ),
            })),
          ),
          Effect.map(Chunk.toArray),
          Effect.flatMap(
            Schema.encodeEither(
              Handler.Config.resolveResponseValidator(
                Handler.Config.response(sheetCalcHandlerConfig),
              ),
            ),
          ),
          Effect.provide(Sheet.layerOfSheetId(sheetId)),
        ),
      ),
      Effect.withSpan("sheetCalcHandler", { captureStackTrace: true }),
    ),
  ),
);
