import { calcHandlerConfig } from "@/server/handler/config";
import {
  CalcConfig,
  CalcService,
  GuildConfigService,
  PlayerTeam,
} from "@/server/services";
import { Array, Chunk, Effect, HashSet, Option, pipe } from "effect";
import { HandlerContextConfig } from "typhoon-core/config";
import { Computed, DependencySignal } from "typhoon-core/signal";
import { Event } from "typhoon-server/server";

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

export const calcHandler = pipe(
  HandlerContextConfig.empty,
  HandlerContextConfig.Builder.config(calcHandlerConfig),
  HandlerContextConfig.Builder.handler(
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
          Computed.annotateLogs("scriptId", googleAppsScriptId),
          Computed.annotateSpans("scriptId", googleAppsScriptId),
        ),
      ),
      Effect.withSpan("calcHandler", { captureStackTrace: true }),
    ),
  ),
);
