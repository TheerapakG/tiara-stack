import { botCalcHandlerConfig } from "@/server/handler/config";
import { CalcConfig, CalcService } from "@/server/services";
import { PlayerTeam, Room } from "@/server/schema";
import { Chunk, Effect, HashSet, pipe, Schema } from "effect";
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
      Effect.Do,
      Effect.bind("parsed", () => Event.request.parsed(botCalcHandlerConfig)),
      Effect.flatMap(({ parsed }) =>
        pipe(
          Computed.make(
            pipe(
              Effect.Do,
              Effect.bind("parsed", () => parsed),
              Effect.let(
                "config",
                ({ parsed }) => new CalcConfig(parsed.config),
              ),
              Effect.bind("players", ({ parsed }) =>
                Effect.forEach(parsed.players, (player) =>
                  Effect.allSuccesses(
                    player.map((team) => PlayerTeam.fromApiObject(team)),
                  ),
                ),
              ),
              Effect.flatMap(({ config, players }) =>
                CalcService.calc(config, players),
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
              Effect.map(Chunk.toArray),
              Effect.flatMap(
                Schema.encodeEither(
                  Handler.Config.resolveResponseValidator(
                    Handler.Config.response(botCalcHandlerConfig),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
      Effect.withSpan("botCalcHandler", { captureStackTrace: true }),
    ),
  ),
);
