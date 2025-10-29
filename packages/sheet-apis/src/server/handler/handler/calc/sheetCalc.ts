import { sheetCalcHandlerConfig } from "@/server/handler/config";
import { CalcConfig, CalcService, Sheet } from "@/server/services";
import { Error, PlayerTeam } from "@/server/schema";
import { Array, Chunk, Effect, HashMap, HashSet, pipe, Option } from "effect";
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
      Computed.flatMap(({ sheetId, config, players, fixedTeams }) =>
        pipe(
          Effect.Do,
          Effect.let("config", () => new CalcConfig(config)),
          Effect.let("fixedTeams", () =>
            HashMap.fromIterable(
              fixedTeams.map(({ name, heal }) => [
                name,
                pipe(
                  HashSet.make("fixed"),
                  HashSet.union(heal ? HashSet.make("heal") : HashSet.empty()),
                ),
              ]),
            ),
          ),
          Effect.bind("playerTeams", ({ fixedTeams }) =>
            Effect.forEach(players, ({ name, encable }) =>
              pipe(
                Sheet.PlayerService.getTeamsByName(name),
                Effect.map(
                  Array.map((team) => PlayerTeam.fromTeam(config.cc, team)),
                ),
                Effect.map(Array.getSomes),
                Effect.map(
                  Array.map((team) =>
                    PlayerTeam.addTags(
                      pipe(
                        HashSet.empty(),
                        HashSet.union(
                          encable ? HashSet.make("encable") : HashSet.empty(),
                        ),
                        HashSet.union(
                          pipe(
                            HashMap.get(fixedTeams, team.team),
                            Option.getOrElse(() => HashSet.empty()),
                          ),
                        ),
                      ),
                    )(team),
                  ),
                ),
              ),
            ),
          ),
          Effect.flatMap(({ config, playerTeams }) =>
            CalcService.calc(config, playerTeams),
          ),
          Effect.provide(Sheet.layerOfSheetId(sheetId)),
        ),
      ),
      Computed.map(Chunk.toArray),
      Computed.mapEffect(Error.Core.catchParseErrorAsValidationError),
      Computed.mapEffect(Effect.either),
      Computed.flatMap(Handler.Config.encodeResponse(sheetCalcHandlerConfig)),
      Computed.mapEffect(Effect.orDie),
      Computed.mapEffect(Effect.flatten),
      Effect.withSpan("sheetCalcHandler", { captureStackTrace: true }),
    ),
  ),
);
