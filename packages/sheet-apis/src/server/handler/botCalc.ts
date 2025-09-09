import { Chunk, Effect, HashSet, pipe } from "effect";
import { computed } from "typhoon-core/signal";
import { defineHandlerConfigBuilder } from "typhoon-server/config";
import { defineHandlerBuilder, Event } from "typhoon-server/server";
import * as v from "valibot";
import { CalcConfig, CalcService, PlayerTeam } from "../../services";

const calcHandlerConfig = defineHandlerConfigBuilder()
  .name("botCalc")
  .type("subscription")
  .request({
    validator: v.object({
      config: v.object({
        healNeeded: v.number(),
        considerEnc: v.boolean(),
      }),
      players: v.pipe(
        v.array(
          v.array(
            v.object({
              type: v.string(),
              tagStr: v.string(),
              player: v.string(),
              team: v.string(),
              lead: v.number(),
              backline: v.number(),
              bp: v.union([v.number(), v.literal("")]),
              percent: v.number(),
            }),
          ),
        ),
        v.length(5),
      ),
    }),
    validate: true,
  })
  .response({
    validator: v.array(
      v.object({
        averageBp: v.number(),
        averagePercent: v.number(),
        room: v.array(
          v.object({
            type: v.string(),
            team: v.string(),
            bp: v.number(),
            percent: v.number(),
            tags: v.array(v.string()),
          }),
        ),
      }),
    ),
  })
  .build();

export const botCalcHandler = defineHandlerBuilder()
  .config(calcHandlerConfig)
  .handler(
    pipe(
      Effect.Do,
      Effect.bind("parsed", () =>
        Event.withConfig(calcHandlerConfig).request.parsed(),
      ),
      Effect.flatMap(({ parsed }) =>
        pipe(
          computed(
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
            ),
          ),
        ),
      ),
      Effect.withSpan("botCalcHandler", { captureStackTrace: true }),
    ),
  );
