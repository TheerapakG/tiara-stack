import { calcHandlerConfig } from "@/server/handler/config";
import { CalcConfig, CalcService, GuildConfigService } from "@/server/services";
import { PlayerTeam, Room } from "@/server/schema";
import { Array, Chunk, Effect, HashSet, Option, pipe, Schema } from "effect";
import { Computed, DependencySignal } from "typhoon-core/signal";
import { Event } from "typhoon-server/event";
import { Context } from "typhoon-server/handler";
import { Handler } from "typhoon-core/server";

const getUserAgent = <E, R>(
  request: DependencySignal.DependencySignal<Request, E, R>,
) =>
  Computed.make(
    pipe(
      request,
      Effect.map(({ headers }) => headers.get("user-agent") ?? ""),
      Effect.withSpan("getUserAgent", { captureStackTrace: true }),
    ),
  );

const extractGoogleAppsScriptId = <E, R>(
  userAgent: Computed.Computed<string, E, R>,
) =>
  Computed.make(
    pipe(
      userAgent,
      Effect.map((userAgent) =>
        userAgent.match(/Google-Apps-Script.*?id:\s*([^\s)]+)/i),
      ),
      Effect.map(Option.fromNullable),
      Effect.map(Option.flatMap(Array.get(1))),
      Effect.flatMap(
        Option.match({
          onSome: (id) => Effect.succeed(id),
          onNone: () =>
            Effect.fail({
              message:
                "this does not seem like a request from an apps script... what are you doing here?",
            }),
        }),
      ),
      Effect.withSpan("extractGoogleAppsScriptId", { captureStackTrace: true }),
    ),
  );

const getGuildConfigByScriptId = <E, R>(
  scriptId: Computed.Computed<string, E, R>,
) =>
  Computed.make(
    pipe(
      scriptId,
      Effect.flatMap(GuildConfigService.getGuildConfigByScriptId),
      Effect.flatMap((computed) => computed),
      Effect.flipWith((effect) =>
        pipe(
          effect,
          Effect.tap(() => Effect.log("unregistered script id")),
          Effect.map(() => ({
            message:
              "unregistered sheet... contact me before yoinking the sheet, could you?",
          })),
        ),
      ),
      Effect.withSpan("guildConfig", { captureStackTrace: true }),
    ),
  );

const builders = Context.Subscription.Builder.builders();
export const calcHandler = pipe(
  builders.empty(),
  builders.data(calcHandlerConfig),
  builders.handler(
    pipe(
      Effect.Do,
      Effect.bind("request", () => Computed.make(Event.webRequest())),
      Effect.bind("userAgent", ({ request }) => getUserAgent(request)),
      Effect.bind("googleAppsScriptId", ({ userAgent }) =>
        extractGoogleAppsScriptId(userAgent),
      ),
      Effect.bind("guildConfig", ({ googleAppsScriptId }) =>
        pipe(
          getGuildConfigByScriptId(googleAppsScriptId),
          Computed.annotateLogs("scriptId", googleAppsScriptId),
          Computed.annotateSpans("scriptId", googleAppsScriptId),
        ),
      ),
      Effect.bind("parsed", ({ googleAppsScriptId }) =>
        pipe(
          Event.request.parsed(calcHandlerConfig),
          Computed.annotateLogs("scriptId", googleAppsScriptId),
          Computed.annotateSpans("scriptId", googleAppsScriptId),
        ),
      ),
      Effect.flatMap(({ guildConfig, parsed, googleAppsScriptId }) =>
        pipe(
          Computed.make(
            pipe(
              Effect.Do,
              Effect.bind("guildConfig", () => guildConfig),
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
                    Handler.Config.response(calcHandlerConfig),
                  ),
                ),
              ),
            ),
          ),
          Computed.annotateLogs("scriptId", googleAppsScriptId),
          Computed.annotateSpans("scriptId", googleAppsScriptId),
        ),
      ),
      Effect.withSpan("calcHandler", { captureStackTrace: true }),
    ),
  ),
);
