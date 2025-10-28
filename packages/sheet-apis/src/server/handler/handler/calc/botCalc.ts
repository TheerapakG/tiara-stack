import { botCalcHandlerConfig } from "@/server/handler/config";
import { CalcConfig, CalcService } from "@/server/services";
import { PlayerTeam, Room } from "@/server/schema";
import { Chunk, Effect, HashSet, pipe } from "effect";
import { Validation } from "typhoon-core/error";
import { Computed } from "typhoon-core/signal";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";

const builders = Context.Subscription.Builder.builders();
export const botCalcHandler = pipe(
  builders.empty(),
  builders.data(botCalcHandlerConfig),
  builders.handler(
    pipe(
      Event.request.parsed(botCalcHandlerConfig),
      Computed.flatMap(({ config, players }) =>
        pipe(
          Effect.Do,
          Effect.let("config", () => new CalcConfig(config)),
          Effect.bind("playerTeams", () =>
            Effect.forEach(players, (player) =>
              Effect.allSuccesses(
                player.map((team) => PlayerTeam.fromApiObject(team)),
              ),
            ),
          ),
          Effect.flatMap(({ config, playerTeams }) =>
            CalcService.calc(config, playerTeams),
          ),
          Effect.map(
            Chunk.map((room) => ({
              averageTalent: Room.avgTalent(room),
              averageEffectValue: Room.avgEffectValue(room),
              room: pipe(
                room.teams,
                Chunk.map((team) => ({
                  type: team.type,
                  team: team.team,
                  talent: team.talent,
                  effectValue: PlayerTeam.getEffectValue(team),
                  tags: HashSet.toValues(team.tags),
                })),
                Chunk.toArray,
              ),
            })),
          ),
        ),
      ),
      Computed.map(Chunk.toArray),
      Computed.mapEffect(Validation.catchParseErrorAsValidationError),
      Computed.mapEffect((effect) =>
        pipe(
          effect,
          Effect.either,
          Effect.flatMap(Handler.Config.encodeResponse(botCalcHandlerConfig)),
          Effect.orDie,
          Effect.flatten,
        ),
      ),
      Effect.withSpan("botCalcHandler", { captureStackTrace: true }),
    ),
  ),
);
