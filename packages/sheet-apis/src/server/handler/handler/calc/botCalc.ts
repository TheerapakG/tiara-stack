import { botCalcHandlerConfig } from "@/server/handler/config";
import { CalcConfig, CalcService } from "@/server/services";
import { Error, PlayerTeam, Room } from "@/server/schema";
import { Chunk, Effect, HashSet, pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { stripHandler } from "typhoon-core/bundler";

const builders = Context.Builder.Subscription.builders();
export const botCalcHandler = pipe(
  builders.empty(),
  builders.data(botCalcHandlerConfig),
  builders.handler(
    stripHandler(
      pipe(
        Event.request.parsed(botCalcHandlerConfig),
        Effect.map(
          Effect.flatMap(({ config, players }) =>
            pipe(
              Effect.Do,
              Effect.let("config", () => new CalcConfig(config)),
              Effect.bind("playerTeams", () =>
                Effect.forEach(players, (player) =>
                  Effect.allSuccesses(
                    // TODO: read cc
                    player.map((team) => PlayerTeam.fromTeam(false, team)),
                  ),
                ),
              ),
              Effect.flatMap(({ config, playerTeams }) => CalcService.calc(config, playerTeams)),
              Effect.map(
                Chunk.map((room) => ({
                  averageTalent: Room.avgTalent(room),
                  averageEffectValue: Room.avgEffectValue(room),
                  room: pipe(
                    room.teams,
                    Chunk.map((team) => ({
                      type: team.type,
                      team: team.teamName,
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
        ),
        Effect.map(Effect.map(Chunk.toArray)),
        Effect.map(Error.Core.catchParseErrorAsValidationError),
        Effect.map(Handler.Config.encodeResponseEffect(botCalcHandlerConfig)),
        Effect.withSpan("botCalcHandler", { captureStackTrace: true }),
      ),
    ),
  ),
);
